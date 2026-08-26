import fs from 'node:fs';
import path from 'node:path';

// Configurações do Ambiente n8n
const N8N_HOST = process.env.N8N_HOST || 'https://emanuelrendas.app.n8n.cloud';
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_KEY) {
  console.error('❌ ERRO: Define a variável de ambiente N8N_API_KEY antes de executar.');
  console.log('Exemplo: $env:N8N_API_KEY="n8n_api_..." ; node scripts/deploy-n8n-workflows.js');
  process.exit(1);
}

const WORKFLOWS_DIR = path.resolve(process.cwd(), 'workflows/n8n');

async function deployWorkflow(filePath) {
  const fileName = path.basename(filePath);
  const rawData = fs.readFileSync(filePath, 'utf-8');
  const workflowData = JSON.parse(rawData);

  console.log(`\n📦 A processar: ${workflowData.name} (${fileName})...`);

  try {
    // 1. Listar workflows existentes para verificar duplicados por nome
    const listRes = await fetch(`${N8N_HOST}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!listRes.ok) {
      throw new Error(`Falha ao contactar API do n8n: ${listRes.status} ${listRes.statusText}`);
    }

    const { data: existingWorkflows } = await listRes.json();
    const existing = existingWorkflows.find((w) => w.name === workflowData.name);

    let res;
    if (existing) {
      console.log(`🔄 A atualizar workflow existente (ID: ${existing.id})...`);
      res = await fetch(`${N8N_HOST}/api/v1/workflows/${existing.id}`, {
        method: 'PUT',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: workflowData.name,
          nodes: workflowData.nodes,
          connections: workflowData.connections,
          settings: workflowData.settings || {}
        })
      });
    } else {
      console.log('✨ A criar novo workflow no n8n...');
      res = await fetch(`${N8N_HOST}/api/v1/workflows`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: workflowData.name,
          nodes: workflowData.nodes,
          connections: workflowData.connections,
          settings: workflowData.settings || {}
        })
      });
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Erro no envio para n8n: ${res.status} - ${errBody}`);
    }

    const deployed = await res.json();
    console.log(`✅ Sucesso! Workflow [${deployed.name}] sincronizado (ID: ${deployed.id}).`);

    // 2. Ativar o workflow em produção
    console.log(`⚡ A ativar workflow ID: ${deployed.id}...`);
    const activateRes = await fetch(`${N8N_HOST}/api/v1/workflows/${deployed.id}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (activateRes.ok) {
      console.log(`🚀 Workflow [${deployed.name}] está ATIVO em produção.`);
    } else {
      console.log(`⚠️ Criado, mas requer associação de credenciais manuais antes de ativar.`);
    }
  } catch (err) {
    console.error(`❌ Falha no deploy de ${fileName}:`, err.message);
  }
}

async function run() {
  if (!fs.existsSync(WORKFLOWS_DIR)) {
    console.error(`❌ Diretoria não encontrada: ${WORKFLOWS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith('.json'));
  console.log(`🔍 Foram encontrados ${files.length} workflows em ${WORKFLOWS_DIR}`);

  for (const file of files) {
    await deployWorkflow(path.join(WORKFLOWS_DIR, file));
  }

  console.log('\n==================================================');
  console.log('🎉 Operação concluída. Todos os workflows foram processados.');
}

run();
