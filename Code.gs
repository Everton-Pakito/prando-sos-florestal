// ============================================================
//  SOS PRANDO – Google Apps Script Backend v2
//  Cole este código em: script.google.com → Novo projeto
//  Implantar → Nova implantação → App da Web
//  Executar como: Eu mesmo | Quem tem acesso: Qualquer pessoa
// ============================================================

const SHEET_ID = 'COLE_AQUI_O_ID_DA_SUA_PLANILHA';
const ABA_OS   = 'OS';
const ABA_LOG  = 'LOG';

// ── Definição oficial das colunas (ordem = ordem na planilha) ──
const COLUNAS = [
  'ID',
  'Data Abertura',
  'Hora Abertura',
  'Timestamp Abertura',
  'Tipo Veiculo',
  'Tipo OS',
  'Motorista',
  'Frota',
  'Placa CM',
  'SRS Ativos',
  'Placas SRS',
  'Status Carga',
  'Descricao',
  'Local',
  'Latitude',
  'Longitude',
  'Status OS',
  'Data Fechamento',
  'Hora Fechamento',
  'Timestamp Fechamento',
  'Tempo Manutencao (min)',
  'Observacao Fechamento'
];

// ════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════

function cors(output) {
  return output
    .setMimeType(ContentService.MimeType.JSON)
    .addHeader('Access-Control-Allow-Origin', '*')
    .addHeader('Access-Control-Allow-Methods', 'GET, POST')
    .addHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(obj) {
  return cors(ContentService.createTextOutput(JSON.stringify(obj)));
}

// Monta array de linha posicionando cada valor pelo nome da coluna.
// Campos não informados ficam como string vazia — nunca undefined/null.
function montarLinha(headers, dados) {
  const linha = new Array(headers.length).fill('');
  for (const [nome, valor] of Object.entries(dados)) {
    const idx = headers.indexOf(nome);
    if (idx !== -1) linha[idx] = (valor === null || valor === undefined) ? '' : valor;
  }
  return linha;
}

// ════════════════════════════════════════════════
//  ESTRUTURA DA PLANILHA
// ════════════════════════════════════════════════

function garantirEstrutura() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // ── Aba OS ──
  let aba = ss.getSheetByName(ABA_OS);
  if (!aba) {
    aba = ss.insertSheet(ABA_OS);
    aba.appendRow(COLUNAS);
    formatarCabecalho(aba);
  } else {
    // Adiciona colunas novas ao final se COLUNAS crescer no futuro
    const existentes = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];
    COLUNAS.forEach(col => {
      if (!existentes.includes(col)) {
        const novaCol = aba.getLastColumn() + 1;
        aba.getRange(1, novaCol)
           .setValue(col)
           .setFontWeight('bold')
           .setBackground('#e63946')
           .setFontColor('#ffffff');
      }
    });
  }

  // ── Aba LOG ──
  let log = ss.getSheetByName(ABA_LOG);
  if (!log) {
    log = ss.insertSheet(ABA_LOG);
    log.appendRow(['Timestamp', 'Acao', 'ID OS', 'Detalhes']);
    log.getRange(1, 1, 1, 4)
       .setFontWeight('bold')
       .setBackground('#1a1a2e')
       .setFontColor('#ffffff');
    log.setFrozenRows(1);
  }

  return ss;
}

function formatarCabecalho(aba) {
  const n = COLUNAS.length;
  aba.getRange(1, 1, 1, n)
     .setFontWeight('bold')
     .setBackground('#e63946')
     .setFontColor('#ffffff')
     .setHorizontalAlignment('center');
  aba.setFrozenRows(1);

  // Larguras sugeridas para facilitar leitura e futuro dashboard
  const larguras = {
    'ID': 170, 'Motorista': 180, 'Descricao': 320,
    'Local': 320, 'Placas SRS': 200, 'Observacao Fechamento': 260,
    'Data Abertura': 110, 'Hora Abertura': 90,
    'Data Fechamento': 110, 'Hora Fechamento': 90,
    'Tempo Manutencao (min)': 140
  };
  COLUNAS.forEach((col, i) => {
    if (larguras[col]) aba.setColumnWidth(i + 1, larguras[col]);
  });
}

function gerarID() {
  const now = new Date();
  const p   = n => String(n).padStart(2, '0');
  const dt  = `${now.getFullYear()}${p(now.getMonth()+1)}${p(now.getDate())}`;
  const rnd = Math.floor(Math.random() * 9000) + 1000;
  return `OS-${dt}-${rnd}`;
}

// ════════════════════════════════════════════════
//  ROUTER
// ════════════════════════════════════════════════

function doGet(e) {
  const action = (e.parameter.action || '').trim();
  try {
    if (action === 'listar')   return listarOS();
    if (action === 'encerrar') return encerrarOS(e.parameter);
    if (action === 'ping')     return json({ ok: true, ts: new Date().toISOString() });
    return json({ erro: 'Acao invalida: ' + action });
  } catch (err) {
    return json({ erro: err.message });
  }
}

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    if (dados.action === 'abrir') return abrirOS(dados);
    return json({ erro: 'Acao invalida' });
  } catch (err) {
    return json({ erro: err.message });
  }
}

// ════════════════════════════════════════════════
//  ABRIR OS
// ════════════════════════════════════════════════

function abrirOS(dados) {
  const ss  = garantirEstrutura();
  const aba = ss.getSheetByName(ABA_OS);

  // Lê o cabeçalho REAL da planilha (pode ter colunas extras manuais)
  const headers = aba.getRange(1, 1, 1, aba.getLastColumn()).getValues()[0];

  const now = new Date();
  const p   = n => String(n).padStart(2, '0');
  const id  = gerarID();

  // Cada chave = nome exato da coluna no cabeçalho
  // Campos opcionais que o formulário não envia ficam como ''
  const registro = {
    'ID'                 : id,
    'Data Abertura'      : `${p(now.getDate())}/${p(now.getMonth()+1)}/${now.getFullYear()}`,
    'Hora Abertura'      : `${p(now.getHours())}:${p(now.getMinutes())}`,
    'Timestamp Abertura' : now.getTime(),
    'Tipo Veiculo'       : dados.tipoVeiculo  || '',
    'Tipo OS'            : dados.tipoOS       || '',
    'Motorista'          : dados.motorista    || '',
    'Frota'              : dados.frota        || '',
    'Placa CM'           : dados.placaCM      || '',
    'SRS Ativos'         : dados.srsAtivos    || '',
    'Placas SRS'         : dados.placasSRS    || '',
    'Status Carga'       : dados.statusCarga  || '',
    'Descricao'          : dados.descricao    || '',
    'Local'              : dados.local        || '',
    'Latitude'           : dados.latitude     || '',
    'Longitude'          : dados.longitude    || '',
    'Status OS'          : 'ABERTA'
    // Campos de fechamento NÃO são definidos aqui — montarLinha os deixa em branco
  };

  const linha = montarLinha(headers, registro);
  aba.appendRow(linha);

  // Destaca o status ABERTA em amarelo
  const lastRow    = aba.getLastRow();
  const colStatus  = headers.indexOf('Status OS') + 1; // base-1
  aba.getRange(lastRow, colStatus)
     .setBackground('#fff3cd')
     .setFontColor('#856404')
     .setFontWeight('bold');

  // Log de auditoria
  ss.getSheetByName(ABA_LOG).appendRow([
    new Date().toISOString(),
    'ABERTURA',
    id,
    [dados.tipoOS, dados.tipoVeiculo, 'Motorista: ' + dados.motorista, 'Frota: ' + dados.frota].join(' | ')
  ]);

  return json({ ok: true, id, dataAb: registro['Data Abertura'], horaAb: registro['Hora Abertura'] });
}

// ════════════════════════════════════════════════
//  LISTAR OS
// ════════════════════════════════════════════════

function listarOS() {
  const ss  = garantirEstrutura();
  const aba = ss.getSheetByName(ABA_OS);

  if (aba.getLastRow() <= 1) return json({ ok: true, dados: [] });

  // Uma única leitura para toda a planilha (eficiente)
  const todos   = aba.getDataRange().getValues();
  const headers = todos[0];

  const dados = todos.slice(1).map(row => {
    const obj = {};
    headers.forEach((col, i) => {
      // Garante que células vazias viram '' e não null/undefined
      obj[col] = (row[i] === null || row[i] === undefined) ? '' : row[i];
    });
    return obj;
  }).reverse(); // mais recentes primeiro no painel

  return json({ ok: true, dados });
}

// ════════════════════════════════════════════════
//  ENCERRAR OS
// ════════════════════════════════════════════════

function encerrarOS(params) {
  const ss  = garantirEstrutura();
  const aba = ss.getSheetByName(ABA_OS);

  const id  = (params.id  || '').trim();
  const obs = (params.obs || '').trim();

  if (!id) return json({ ok: false, erro: 'ID nao informado' });

  // Lê tudo de uma vez
  const todos   = aba.getDataRange().getValues();
  const headers = todos[0];

  // Encontra a linha pelo ID (coluna 'ID')
  const colID = headers.indexOf('ID');
  if (colID === -1) return json({ ok: false, erro: 'Coluna ID nao encontrada' });

  let rowIdxBase0 = -1;
  for (let i = 1; i < todos.length; i++) {
    if (String(todos[i][colID]).trim() === id) { rowIdxBase0 = i; break; }
  }
  if (rowIdxBase0 === -1) return json({ ok: false, erro: 'OS nao encontrada: ' + id });

  // Impede encerrar duas vezes
  const colStatusIdx = headers.indexOf('Status OS');
  if (String(todos[rowIdxBase0][colStatusIdx]).trim() === 'ENCERRADA') {
    return json({ ok: false, erro: 'OS ja encerrada' });
  }

  // Calcula duração
  const now    = new Date();
  const p      = n => String(n).padStart(2, '0');
  const tsAb   = Number(todos[rowIdxBase0][headers.indexOf('Timestamp Abertura')]) || 0;
  const tsFec  = now.getTime();
  const minutos = tsAb > 0 ? Math.round((tsFec - tsAb) / 60000) : 0;

  // Campos a atualizar — chave = nome exato da coluna
  const fechamento = {
    'Status OS'              : 'ENCERRADA',
    'Data Fechamento'        : `${p(now.getDate())}/${p(now.getMonth()+1)}/${now.getFullYear()}`,
    'Hora Fechamento'        : `${p(now.getHours())}:${p(now.getMinutes())}`,
    'Timestamp Fechamento'   : tsFec,
    'Tempo Manutencao (min)' : minutos,
    'Observacao Fechamento'  : obs
  };

  // Atualiza célula por célula pelo nome da coluna
  // Nunca reescreve a linha inteira — preserva dados originais e colunas extras
  const sheetRow = rowIdxBase0 + 1; // base-1 para a API do Sheets
  for (const [nomCol, valor] of Object.entries(fechamento)) {
    const idx = headers.indexOf(nomCol);
    if (idx !== -1) aba.getRange(sheetRow, idx + 1).setValue(valor);
  }

  // Formatação visual: linha verde suave + status em destaque
  aba.getRange(sheetRow, 1, 1, headers.length).setBackground('#d4edda');
  const colStatusBase1 = colStatusIdx + 1;
  aba.getRange(sheetRow, colStatusBase1)
     .setFontColor('#155724')
     .setFontWeight('bold')
     .setBackground('#c3e6cb');

  // Log
  ss.getSheetByName(ABA_LOG).appendRow([
    new Date().toISOString(),
    'ENCERRAMENTO',
    id,
    'Duracao: ' + minutos + ' min | Obs: ' + (obs || '-')
  ]);

  return json({ ok: true, minutos, dataFec: fechamento['Data Fechamento'], horaFec: fechamento['Hora Fechamento'] });
}
