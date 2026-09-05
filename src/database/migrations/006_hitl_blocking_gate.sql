-- ==========================================================================
-- MISSION-017 — HITL BLOCKING GATE
-- Repositório: raioc-os
-- Base de dados: tovfnshstqxmwwlllthj (raioc-os)
-- Autor da especificação: auditoria independente, 05 Set 2026
-- Estado: PROPOSTA. NÃO APLICADA. Requer aprovação do Emanuel.
-- ==========================================================================
--
-- PROBLEMA (achado de Diogo, WF01-DOC-01)
--
--   A topologia atual do WF-01 é:
--
--       IF TRUE  ->  criar registo PENDING  ->  CRM
--
--   Não existe espera. Não existe verificação de aprovação. O workflow cria
--   um registo a declarar "pendente de aprovação humana" e segue de imediato.
--   O human-in-the-loop não bloqueia nada. É um registo decorativo.
--
--   Uma regra escrita no n8n não resolve isto, porque cinco workflows
--   distintos estão ligados ao mesmo path /webhook/raioc-lead-ingest e
--   qualquer um deles pode escrever. A única fronteira que os cinco
--   partilham é a base de dados. É lá que a trava tem de viver.
--
-- PORQUÊ AQUI E NÃO NO CÓDIGO
--
--   Pela Lei 4 do protocolo canónico (ADR-015D): execution_effects é
--   "the source of truth for whether an effect was authorized". O comentário
--   da própria tabela já o diz. Falta apenas o mecanismo que o torna verdade.
--
--   Pelo kill-switch do protocolo: "Disparo de webhooks reais para clientes
--   sem confirmação prévia de consent_status === 'opted_in'". Este ficheiro
--   é a implementação desse kill-switch ao nível do motor.
--
-- O QUE ESTA MIGRAÇÃO FAZ
--
--   1. Acrescenta autoridade humana explícita a execution_effects.
--   2. Impede a transição RESERVED -> DISPATCHED sem essa autoridade.
--   3. Impede qualquer efeito dirigido a um lead cujo consent_status não
--      seja opted_in.
--   4. Regista quem aprovou e quando, para auditoria.
--
--   Nenhum dado existente é alterado. Nenhuma linha é apagada.
--   As tabelas afetadas têm zero linhas hoje, portanto o risco de aplicação
--   é mínimo e nenhum fluxo em produção é interrompido.
--
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Autoridade humana como coluna de primeira classe
-- --------------------------------------------------------------------------

ALTER TABLE public.execution_effects
  ADD COLUMN IF NOT EXISTS requires_human_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS approved_by             text,
  ADD COLUMN IF NOT EXISTS approved_at             timestamptz,
  ADD COLUMN IF NOT EXISTS approval_ref            uuid;

COMMENT ON COLUMN public.execution_effects.requires_human_approval IS
  'Default true por desenho. Um efeito externamente visível é considerado a precisar de autoridade humana até que alguém decida o contrário de forma explícita. Fail-closed.';

COMMENT ON COLUMN public.execution_effects.approved_by IS
  'Identidade humana que autorizou este efeito concreto. Nunca preenchido por um agente, workflow ou serviço.';

COMMENT ON COLUMN public.execution_effects.approval_ref IS
  'Liga a executive_approvals.id quando a aprovação passou pela fila de Mission Control.';

ALTER TABLE public.execution_effects
  DROP CONSTRAINT IF EXISTS execution_effects_approval_ref_fkey;

ALTER TABLE public.execution_effects
  ADD CONSTRAINT execution_effects_approval_ref_fkey
  FOREIGN KEY (approval_ref) REFERENCES public.executive_approvals(id);

-- --------------------------------------------------------------------------
-- 2. Coerência interna: aprovado significa aprovado por alguém, com data
-- --------------------------------------------------------------------------

ALTER TABLE public.execution_effects
  DROP CONSTRAINT IF EXISTS execution_effects_approval_coherent;

ALTER TABLE public.execution_effects
  ADD CONSTRAINT execution_effects_approval_coherent CHECK (
    (approved_by IS NULL     AND approved_at IS NULL)
    OR
    (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  );

-- --------------------------------------------------------------------------
-- 3. A trava: nada é despachado sem autoridade e sem consentimento
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_hitl_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consent      text;
  v_lead_status  text;
  v_lead_id      uuid;
BEGIN
  -- Só interessa a transição para DISPATCHED. Criar um efeito RESERVED é
  -- livre: reservar não é contactar.
  IF NEW.status IS DISTINCT FROM 'DISPATCHED' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'DISPATCHED' THEN
    RETURN NEW;  -- já despachado, não reavalia
  END IF;

  -- 3a. Autoridade humana
  IF NEW.requires_human_approval AND NEW.approved_by IS NULL THEN
    RAISE EXCEPTION
      'HITL_GATE: efeito % (tipo %) não pode passar a DISPATCHED sem approved_by. Criar um registo PENDING não é aprovação.',
      NEW.id, NEW.effect_type
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3b. Consentimento do titular dos dados
  SELECT le.lead_id INTO v_lead_id
  FROM public.lead_executions le
  WHERE le.id = NEW.execution_id;

  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION
      'HITL_GATE: efeito % não resolve para um lead. Fail-closed.',
      NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT l.consent_status, l.status
    INTO v_consent, v_lead_status
  FROM public.leads l
  WHERE l.id = v_lead_id;

  IF v_lead_status = 'do_not_contact' THEN
    RAISE EXCEPTION
      'HITL_GATE: lead % está marcado do_not_contact. Efeito % recusado.',
      v_lead_id, NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_consent IS DISTINCT FROM 'opted_in' THEN
    RAISE EXCEPTION
      'HITL_GATE: lead % tem consent_status=% . Nenhum efeito automatizado é despachado sem opted_in explícito (ADR-0001).',
      v_lead_id, COALESCE(v_consent, 'NULL')
      USING ERRCODE = 'check_violation';
  END IF;

  -- 3c. Carimbo temporal do despacho
  IF NEW.dispatched_at IS NULL THEN
    NEW.dispatched_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_hitl_gate() IS
  'MISSION-017. Bloqueia a transição de execution_effects para DISPATCHED sem aprovação humana registada e sem consent_status=opted_in no lead. Aplica-se a qualquer escritor, incluindo os cinco workflows n8n ligados a /webhook/raioc-lead-ingest.';

DROP TRIGGER IF EXISTS trg_enforce_hitl_gate ON public.execution_effects;

CREATE TRIGGER trg_enforce_hitl_gate
  BEFORE INSERT OR UPDATE ON public.execution_effects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_hitl_gate();

-- --------------------------------------------------------------------------
-- 4. Contacto manual do Emanuel continua livre
-- --------------------------------------------------------------------------
-- Esta trava governa apenas efeitos automatizados registados em
-- execution_effects. Não toca em leads.last_manual_contact_at nem em
-- manual_contact_outcome, que existem precisamente para registar contacto
-- pessoal feito por um humano fora do pipeline. Um advisor licenciado a
-- ligar a alguém não é um efeito de máquina e não passa por aqui.
-- --------------------------------------------------------------------------

COMMIT;

-- ==========================================================================
-- VERIFICAÇÃO APÓS APLICAÇÃO (correr em transação e fazer ROLLBACK)
-- ==========================================================================
--
-- BEGIN;
--   INSERT INTO leads (name, email, source, consent_status)
--     VALUES ('HITL probe', 'probe@example.invalid', 'internal_engineering_test', 'unknown')
--     RETURNING id;                                    -- guardar como :lead
--   INSERT INTO lead_executions (lead_id, workflow_key, workflow_version)
--     VALUES (:lead, 'wf01_lead_triage', 'probe') RETURNING id;   -- :exec
--
--   -- Deve PASSAR: reservar não é contactar
--   INSERT INTO execution_effects (execution_id, effect_type, status)
--     VALUES (:exec, 'whatsapp_outreach', 'RESERVED');
--
--   -- Deve FALHAR: sem aprovação humana
--   UPDATE execution_effects SET status = 'DISPATCHED' WHERE execution_id = :exec;
--   -- esperado: HITL_GATE: ... sem approved_by
--
--   -- Deve FALHAR: com aprovação, mas consentimento desconhecido
--   UPDATE execution_effects
--      SET status = 'DISPATCHED', approved_by = 'emanuel', approved_at = now()
--    WHERE execution_id = :exec;
--   -- esperado: HITL_GATE: ... consent_status=unknown
--
--   -- Deve PASSAR: aprovação humana e consentimento explícito
--   UPDATE leads SET consent_status = 'opted_in' WHERE id = :lead;
--   UPDATE execution_effects
--      SET status = 'DISPATCHED', approved_by = 'emanuel', approved_at = now()
--    WHERE execution_id = :exec;
-- ROLLBACK;
--
-- ==========================================================================
-- BLAST RADIUS
--   Tabelas alteradas:      execution_effects (0 linhas hoje)
--   Tabelas lidas:          lead_executions, leads
--   Dados alterados:        nenhum
--   Fluxos interrompidos:   nenhum, porque nada despacha efeitos hoje
--   Reversível:             sim, DROP TRIGGER e DROP FUNCTION
-- ==========================================================================

-- ==========================================================================
-- REGISTO DE APLICAÇÃO E PROVA
-- ==========================================================================
-- Aplicada em:      2026-09-05, projeto tovfnshstqxmwwlllthj (raioc-os)
-- Autorizada por:   Emanuel Rendas, autorização formal explícita
-- Nome da migração: hitl_blocking_gate
--
-- PROVA TRANSACIONAL, executada em BEGIN e revertida sem persistir:
--
--   1  INSERT status=RESERVED .................... ACEITE    PASS
--   2  DISPATCHED sem approved_by ................ RECUSADO  PASS
--   3  DISPATCHED aprovado, consent=unknown ...... RECUSADO  PASS
--   4  DISPATCHED com lead do_not_contact ........ RECUSADO  PASS
--   5  DISPATCHED aprovado + consent opted_in .... ACEITE    PASS
--   6  Contacto manual do Emanuel ................ LIVRE     PASS
--   7  approved_by sem approved_at ............... RECUSADO  PASS
--
--   7 de 7 PASS.
--
-- ESTADO APÓS APLICAÇÃO, verificado:
--   leads probe residuais ............ 0
--   execuções probe residuais ........ 0
--   execution_effects totais ......... 0
--   leads em produção ................ 1256, inalterados
--   trigger trg_enforce_hitl_gate .... ativo
--   colunas novas .................... 4 de 4 presentes
--
-- CONTACTO MANUAL: confirmado livre. leads.last_manual_contact_at e
-- manual_contact_outcome gravam sem passar pela trava, como desenhado.
-- ==========================================================================
