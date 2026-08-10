const PROJECT_ID = 'lmpl-quality-department';
const MASTER_ADMIN = 'bcieszczyk@leroymerlin.pl';

const BU_CONFIG = {
  PL: {
    dataset: 'dashboardCompliance_LMPL',
    domain: '@leroymerlin.pl',
    languages: [
      {
        id: 'LOCAL',
        flag: '🇵🇱',
        name: 'Wersja Polska',
        defSubj: 'Zaległe dokumenty / Missing documents',
        defBody: 'Dzień dobry,\n\nProszę o uzupełnienie poniższych dokumentów:'
      },
      {
        id: 'RO',
        flag: '🇷🇴',
        name: 'Versiunea Română',
        defSubj: 'Documente lipsă',
        defBody: 'Buna ziua,\n\nVă rugăm să furnizați următoarele documente:'
      },
      {
        id: 'EN',
        flag: '🇬🇧',
        name: 'English',
        defSubj: 'Action Required: Missing Compliance Documents',
        defBody: 'Dear Supplier,\n\nPlease provide the missing documents listed below:'
      }
    ],
    emptyDoc: 'Dokument nie jest wymagany',
    headers: [
      'Kod produktu',
      'Nazwa produktu',
      'Dostawca',
      'Data',
      'Typ akcji',
      'Status akcji',
      'Wymagane dokumenty'
    ]
  },

  IT: {
    dataset: 'dashboardCompliance_LMIT',
    domain: '@leroymerlin.it',
    languages: [
      {
        id: 'LOCAL',
        flag: '🇮🇹',
        name: 'Versione Italiana',
        defSubj: 'Documenti mancanti',
        defBody: 'Buongiorno,\n\nSi prega di fornire i documenti mancanti:'
      },
      {
        id: 'EN',
        flag: '🇬🇧',
        name: 'English',
        defSubj: 'Action Required: Missing Compliance Documents',
        defBody: 'Dear Supplier,\n\nPlease provide the missing documents listed below:'
      }
    ],
    emptyDoc: 'Nessun documento richiesto',
    headers: [
      'Codice prodotto',
      'Nome prodotto',
      'Fornitore',
      'Data',
      'Tipo di azione',
      'Stato azione',
      'Documenti richiesti'
    ]
  },

  ES: {
    dataset: 'dashboardCompliance_LMES',
    domain: '@leroymerlin.es',
    languages: [
      {
        id: 'LOCAL',
        flag: '🇪🇸',
        name: 'Versión Española',
        defSubj: 'Documentos requeridos',
        defBody: 'Buenos días,\n\nPor favor, proporcione los documentos requeridos:'
      },
      {
        id: 'PT',
        flag: '🇵🇹',
        name: 'Versão Portuguesa',
        defSubj: 'Documentos em falta',
        defBody: 'Bom dia,\n\nPor favor, forneça os documentos em falta:'
      },
      {
        id: 'EN',
        flag: '🇬🇧',
        name: 'English',
        defSubj: 'Action Required: Missing Compliance Documents',
        defBody: 'Dear Supplier,\n\nPlease provide the missing documents listed below:'
      }
    ],
    emptyDoc: 'Ningún documento requerido',
    headers: [
      'Código de producto',
      'Nombre del producto',
      'Proveedor',
      'Fecha',
      'Tipo de acción',
      'Estado de la acción',
      'Documentos requeridos'
    ]
  }
};

function doGet(e) {
  // Keep the current authorization behaviour unchanged.
  DriveApp.getRootFolder();

  return HtmlService.createHtmlOutputFromFile('Index.html')
    .setTitle('Compliance Mailer')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserRole() {
  let realEmail = Session.getActiveUser().getEmail().toLowerCase();
  if (!realEmail) realEmail = MASTER_ADMIN;

  let isMaster = realEmail === MASTER_ADMIN;
  let userProps = PropertiesService.getUserProperties();
  let spoofActive = userProps.getProperty('SPOOF_ACTIVE') === 'true';
  let effectiveEmail = realEmail;

  let bu = 'PL';

  const itRegex = /@(ext\.)?leroymerlin\.it$/;
  const esRegex = /@(ext\.)?leroymerlin\.es$/;
  const ptRegex = /@(ext\.)?leroymerlin\.pt$/;
  const plRegex = /@(ext\.)?leroymerlin\.pl$/;

  if (itRegex.test(effectiveEmail)) {
    bu = 'IT';
  } else if (esRegex.test(effectiveEmail) || ptRegex.test(effectiveEmail)) {
    bu = 'ES';
  } else if (plRegex.test(effectiveEmail)) {
    bu = 'PL';
  }

  let scriptProps = PropertiesService.getScriptProperties();
  let adminsStr = scriptProps.getProperty('ADMIN_LIST');
  let admins = adminsStr ? JSON.parse(adminsStr) : [];
  let isAdmin = isMaster || admins.includes(effectiveEmail);
  let spoofTarget = bu;

  if (isMaster && spoofActive) {
    spoofTarget = userProps.getProperty('SPOOF_BU') || 'PL';

    if (spoofTarget === 'PT') {
      bu = 'ES';
    } else {
      bu = spoofTarget;
    }

    isAdmin = userProps.getProperty('SPOOF_ROLE') === 'admin';
  }

  return {
    realEmail: realEmail,
    email: effectiveEmail,
    isAdmin: isAdmin,
    isMaster: isMaster,
    adminList: admins,
    bu: bu,
    spoofTarget: spoofTarget,
    isSpoofing: isMaster && spoofActive
  };
}

function setDiagnosticMode(targetBu, targetRole) {
  if (getUserRole().realEmail !== MASTER_ADMIN) {
    throw new Error('Unauthorized');
  }

  let props = PropertiesService.getUserProperties();
  props.setProperty('SPOOF_ACTIVE', 'true');
  props.setProperty('SPOOF_BU', targetBu);
  props.setProperty('SPOOF_ROLE', targetRole);

  return true;
}

function clearDiagnosticMode() {
  if (getUserRole().realEmail !== MASTER_ADMIN) {
    throw new Error('Unauthorized');
  }

  let props = PropertiesService.getUserProperties();
  props.deleteProperty('SPOOF_ACTIVE');
  props.deleteProperty('SPOOF_BU');
  props.deleteProperty('SPOOF_ROLE');

  return true;
}

function addAdmin(newEmail) {
  let role = getUserRole();
  if (!role.isAdmin) throw new Error('Unauthorized');

  newEmail = newEmail.toLowerCase().trim();
  if (!newEmail) throw new Error('Email cannot be empty.');

  let props = PropertiesService.getScriptProperties();
  let adminsStr = props.getProperty('ADMIN_LIST');
  let admins = adminsStr ? JSON.parse(adminsStr) : [];

  if (!admins.includes(newEmail) && newEmail !== MASTER_ADMIN) {
    admins.push(newEmail);
    props.setProperty('ADMIN_LIST', JSON.stringify(admins));
  }

  return admins;
}

function removeAdmin(removeEmail) {
  let role = getUserRole();
  if (!role.isAdmin) throw new Error('Unauthorized');

  removeEmail = removeEmail.toLowerCase().trim();

  if (removeEmail === MASTER_ADMIN) {
    throw new Error('Cannot remove the Master Admin.');
  }

  let props = PropertiesService.getScriptProperties();
  let adminsStr = props.getProperty('ADMIN_LIST');
  let admins = adminsStr ? JSON.parse(adminsStr) : [];

  admins = admins.filter(email => email !== removeEmail);
  props.setProperty('ADMIN_LIST', JSON.stringify(admins));

  return admins;
}

function loadSettings() {
  const role = getUserRole();
  const bu = role.bu;
  const config = BU_CONFIG[bu];
  const props = PropertiesService.getScriptProperties().getProperties();

  let settings = {
    languages: config.languages,
    templates: {}
  };

  config.languages.forEach(lang => {
    let propKeySubj =
      lang.id === 'LOCAL'
        ? `${bu}_subjLocal`
        : lang.id === 'EN'
          ? `${bu}_subjEN`
          : `${bu}_subj_${lang.id}`;

    let propKeyBody =
      lang.id === 'LOCAL'
        ? `${bu}_bodyLocal`
        : lang.id === 'EN'
          ? `${bu}_bodyEN`
          : `${bu}_body_${lang.id}`;

    settings.templates[lang.id] = {
      subj: props[propKeySubj] || lang.defSubj,
      body: props[propKeyBody] || lang.defBody
    };
  });

  return settings;
}

function saveSettings(templates) {
  let role = getUserRole();
  if (!role.isAdmin) throw new Error('Unauthorized');

  let bu = role.bu;
  let propsToSave = {};

  for (let langId in templates) {
    let propKeySubj =
      langId === 'LOCAL'
        ? `${bu}_subjLocal`
        : langId === 'EN'
          ? `${bu}_subjEN`
          : `${bu}_subj_${langId}`;

    let propKeyBody =
      langId === 'LOCAL'
        ? `${bu}_bodyLocal`
        : langId === 'EN'
          ? `${bu}_bodyEN`
          : `${bu}_body_${langId}`;

    propsToSave[propKeySubj] = templates[langId].subj;
    propsToSave[propKeyBody] = templates[langId].body;
  }

  PropertiesService.getScriptProperties().setProperties(propsToSave);
  return true;
}

function getDbFolder() {
  let props;
  let folderId;

  try {
    props = PropertiesService.getScriptProperties();
    folderId = props.getProperty('JSON_DB_FOLDER_ID');
  } catch (e) {
    throw new Error('[TRACE 1] PropertiesService failed: ' + e.message);
  }

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      throw new Error(
        `[TRACE 2] Failed to open existing folder (ID: ${folderId}). ` +
        'The folder is shared, which means the user has not authorized ' +
        'this Apps Script to use Google Drive. Error: ' +
        e.message
      );
    }
  }

  try {
    let folder = DriveApp.createFolder('Compliance Mailer DB');
    props.setProperty('JSON_DB_FOLDER_ID', folder.getId());
    return folder;
  } catch (e) {
    throw new Error(
      '[TRACE 3] Failed to create new Drive Folder. ' +
      'The user has not authorized the script to use Drive permissions. Error: ' +
      e.message
    );
  }
}

function getDbFile(fileName, defaultText = '[]') {
  let folder;
  let files;
  let targetFile = null;

  try {
    folder = getDbFolder();
  } catch (e) {
    throw e;
  }

  try {
    files = folder.getFilesByName(fileName);
  } catch (e) {
    throw new Error(
      '[TRACE 4] Failed searching for file inside the database folder: ' +
      e.message
    );
  }

  if (files.hasNext()) {
    try {
      targetFile = files.next();

      while (files.hasNext()) {
        files.next().setTrashed(true);
      }

      return targetFile;
    } catch (e) {
      throw new Error(
        '[TRACE 5] Failed attempting to delete duplicate database files: ' +
        e.message
      );
    }
  }

  try {
    return folder.createFile(fileName, defaultText, MimeType.PLAIN_TEXT);
  } catch (e) {
    throw new Error('[TRACE 6] Failed to create JSON file in Drive: ' + e.message);
  }
}

function saveJson(fileName, data) {
  let file;
  const dataString = JSON.stringify(data);

  try {
    file = getDbFile(fileName, dataString);
  } catch (e) {
    throw e;
  }

  try {
    file.setContent(dataString);
  } catch (e) {
    throw new Error('[TRACE 7] Failed to write data to file: ' + e.message);
  }
}

function loadJson(fileName, defaultValue) {
  let file;
  let text;
  const defaultText = JSON.stringify(defaultValue);

  try {
    file = getDbFile(fileName, defaultText);
  } catch (e) {
    throw e;
  }

  try {
    text = file.getBlob().getDataAsString();
  } catch (e) {
    throw new Error(
      '[TRACE 8] Failed to read text from Drive file blob: ' + e.message
    );
  }

  if (!text) return defaultValue;

  try {
    let parsed = JSON.parse(text);

    if (
      Array.isArray(parsed) &&
      parsed.length === 0 &&
      !Array.isArray(defaultValue)
    ) {
      return defaultValue;
    }

    return parsed;
  } catch (e) {
    return defaultValue;
  }
}

function resetLogs() {
  let role = getUserRole();
  if (!role.isAdmin) throw new Error('Unauthorized');

  let lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
    saveJson(`logs_${role.bu}.json`, {});
  } catch (e) {
    throw new Error(
      "The system is busy saving another user's logs. Please try again."
    );
  } finally {
    lock.releaseLock();
  }

  return true;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================================
// PER-USER XLSX SETTINGS
// ============================================================

const DEFAULT_XLSX_THRESHOLD = 20;
const MIN_XLSX_THRESHOLD = 1;
const MAX_XLSX_THRESHOLD = 500;


/**
 * Returns the XLSX threshold saved for the current user.
 *
 * Example:
 * threshold = 20
 * XLSX is created for 21 or more actions.
 */
function getUserXlsxThreshold() {
  const userProps = PropertiesService.getUserProperties();
  const savedValue = Number(
    userProps.getProperty('XLSX_THRESHOLD')
  );

  if (
    Number.isInteger(savedValue) &&
    savedValue >= MIN_XLSX_THRESHOLD &&
    savedValue <= MAX_XLSX_THRESHOLD
  ) {
    return savedValue;
  }

  return DEFAULT_XLSX_THRESHOLD;
}


/**
 * Saves the XLSX threshold only for the current user.
 */
function saveUserXlsxThreshold(value) {
  const threshold = Number(value);

  if (
    !Number.isInteger(threshold) ||
    threshold < MIN_XLSX_THRESHOLD ||
    threshold > MAX_XLSX_THRESHOLD
  ) {
    throw new Error(
      `The XLSX threshold must be a whole number between ` +
      `${MIN_XLSX_THRESHOLD} and ${MAX_XLSX_THRESHOLD}.`
    );
  }

  PropertiesService
    .getUserProperties()
    .setProperty(
      'XLSX_THRESHOLD',
      String(threshold)
    );

  return threshold;
}


// ============================================================
// LANGUAGE-SPECIFIC EMAIL AND XLSX CONTENT
// ============================================================

function getDraftLanguageContent(bu, langId, config) {
  const languageContent = {

    PL: {
      LOCAL: {
        headers: [
          'Kod produktu',
          'Nazwa produktu',
          'Dostawca',
          'Data',
          'Typ akcji',
          'Status akcji',
          'Wymagane dokumenty'
        ],

        emptyDoc:
          'Dokument nie jest wymagany',

        xlsxNoticeTitle:
          'Pełna lista działań do wykonania znajduje się w załączniku XLSX.',

        xlsxNoticeCount:
          'Załącznik zawiera {count} działań.'
      },

      RO: {
        headers: [
          'Cod produs',
          'Nume produs',
          'Furnizor',
          'Data',
          'Tip acțiune',
          'Status acțiune',
          'Documente necesare'
        ],

        emptyDoc:
          'Nu este necesar niciun document',

        xlsxNoticeTitle:
          'Lista completă a acțiunilor de realizat se află în fișierul XLSX atașat.',

        xlsxNoticeCount:
          'Fișierul atașat conține {count} acțiuni.'
      },

      EN: {
        headers: [
          'Product code',
          'Product name',
          'Supplier name',
          'Create date',
          'Action type',
          'Action status',
          'Required documents'
        ],

        emptyDoc:
          'No document required',

        xlsxNoticeTitle:
          'A full list of actions to complete is included in the XLSX attachment.',

        xlsxNoticeCount:
          'The attachment contains {count} actions.'
      }
    },


    IT: {
      LOCAL: {
        headers: [
          'Codice prodotto',
          'Nome prodotto',
          'Fornitore',
          'Data',
          'Tipo di azione',
          'Stato dell’azione',
          'Documenti richiesti'
        ],

        emptyDoc:
          'Nessun documento richiesto',

        xlsxNoticeTitle:
          'L’elenco completo delle azioni da completare è incluso nell’allegato XLSX.',

        xlsxNoticeCount:
          'L’allegato contiene {count} azioni.'
      },

      EN: {
        headers: [
          'Product code',
          'Product name',
          'Supplier name',
          'Create date',
          'Action type',
          'Action status',
          'Required documents'
        ],

        emptyDoc:
          'No document required',

        xlsxNoticeTitle:
          'A full list of actions to complete is included in the XLSX attachment.',

        xlsxNoticeCount:
          'The attachment contains {count} actions.'
      }
    },


    ES: {
      LOCAL: {
        headers: [
          'Código de producto',
          'Nombre del producto',
          'Proveedor',
          'Fecha',
          'Tipo de acción',
          'Estado de la acción',
          'Documentos requeridos'
        ],

        emptyDoc:
          'Ningún documento requerido',

        xlsxNoticeTitle:
          'La lista completa de acciones pendientes está incluida en el archivo XLSX adjunto.',

        xlsxNoticeCount:
          'El archivo adjunto contiene {count} acciones.'
      },

      PT: {
        headers: [
          'Código do produto',
          'Nome do produto',
          'Fornecedor',
          'Data',
          'Tipo de ação',
          'Estado da ação',
          'Documentos necessários'
        ],

        emptyDoc:
          'Não é necessário nenhum documento',

        xlsxNoticeTitle:
          'A lista completa das ações a realizar está incluída no anexo XLSX.',

        xlsxNoticeCount:
          'O anexo contém {count} ações.'
      },

      EN: {
        headers: [
          'Product code',
          'Product name',
          'Supplier name',
          'Create date',
          'Action type',
          'Action status',
          'Required documents'
        ],

        emptyDoc:
          'No document required',

        xlsxNoticeTitle:
          'A full list of actions to complete is included in the XLSX attachment.',

        xlsxNoticeCount:
          'The attachment contains {count} actions.'
      }
    }
  };


  if (
    languageContent[bu] &&
    languageContent[bu][langId]
  ) {
    return languageContent[bu][langId];
  }


  // Safe fallback if an unknown language is received.
  return {
    headers: config.headers,

    emptyDoc: config.emptyDoc,

    xlsxNoticeTitle:
      'A full list of actions to complete is included in the XLSX attachment.',

    xlsxNoticeCount:
      'The attachment contains {count} actions.'
  };
}

function addCcAddresses(targetSet, rawValue) {
  String(rawValue || '')
    .split(/[;,]/)
    .map(email => email.trim().toLowerCase())
    .filter(email => email && email.includes('@'))
    .forEach(email => targetSet.add(email));
}

function xlsxEscapeXml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xlsxColumnName(columnIndex) {
  let result = '';
  let number = columnIndex + 1;

  while (number > 0) {
    const remainder = (number - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    number = Math.floor((number - 1) / 26);
  }

  return result;
}

// Matches the black/red colors used for uploaded/missing documents in the email table.
const XLSX_DOC_UPLOADED_COLOR = 'FF2C3E50';
const XLSX_DOC_MISSING_COLOR = 'FFE74C3C';

function buildDocumentsRichRuns(docs, emptyDocText) {
  if (!docs || docs.length === 0) {
    return [{ text: emptyDocText, color: null }];
  }

  return docs.map((document, index) => {
    const uploadedValue = String(
      document.uploaded === null || document.uploaded === undefined
        ? ''
        : document.uploaded
    )
      .trim()
      .toLowerCase();

    const isMissing =
      uploadedValue === '0' ||
      uploadedValue === 'false' ||
      uploadedValue === 'null' ||
      uploadedValue === '';

    const color = isMissing
      ? XLSX_DOC_MISSING_COLOR
      : XLSX_DOC_UPLOADED_COLOR;

    const name = String(
      document.name === null || document.name === undefined
        ? ''
        : document.name
    );

    return {
      text: (index === 0 ? '' : '\n') + name,
      color: color
    };
  });
}

function xlsxRichTextRunXml(run) {
  const colorXml = run.color ? `<color rgb="${run.color}"/>` : '';

  return (
    '<r><rPr><sz val="11"/>' +
    colorXml +
    '<rFont val="Arial"/></rPr>' +
    '<t xml:space="preserve">' +
    xlsxEscapeXml(run.text) +
    '</t></r>'
  );
}

function createActionsXlsxAttachment(
  supplierName,
  rows,
  headers,
  emptyDocText
) {
  const docsColumnIndex = headers.length - 1;
  const totalRows = rows.length + 1;

  const headerCellsXml = headers
    .map((cellValue, columnIndex) => {
      const cellReference = xlsxColumnName(columnIndex) + 1;

      return (
        `<c r="${cellReference}" t="inlineStr" s="1">` +
        '<is><t xml:space="preserve">' +
        xlsxEscapeXml(cellValue) +
        '</t></is></c>'
      );
    })
    .join('');

  const dataRowsXml = rows
    .map((val, rowIndex) => {
      const excelRowNumber = rowIndex + 2;

      const plainCellsXml = [
        val.code,
        val.name,
        val.supp,
        val.date,
        val.type,
        val.status
      ]
        .map((cellValue, columnIndex) => {
          const cellReference =
            xlsxColumnName(columnIndex) + excelRowNumber;

          return (
            `<c r="${cellReference}" t="inlineStr" s="0">` +
            '<is><t xml:space="preserve">' +
            xlsxEscapeXml(cellValue) +
            '</t></is></c>'
          );
        })
        .join('');

      const docsRuns = buildDocumentsRichRuns(val.docs, emptyDocText);
      const docsRunsXml = docsRuns.map(xlsxRichTextRunXml).join('');
      const docsCellReference =
        xlsxColumnName(docsColumnIndex) + excelRowNumber;

      const docsCellXml =
        `<c r="${docsCellReference}" t="inlineStr" s="0">` +
        `<is>${docsRunsXml}</is></c>`;

      return `<row r="${excelRowNumber}">${plainCellsXml}${docsCellXml}</row>`;
    })
    .join('');

  const worksheetRowsXml =
    `<row r="1">${headerCellsXml}</row>` + dataRowsXml;

  const lastColumn = xlsxColumnName(headers.length - 1);
  const lastCell = lastColumn + totalRows;

  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>';

  const rootRelationshipsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets><sheet name="Actions" sheetId="1" r:id="rId1"/></sheets>' +
    '</workbook>';

  const workbookRelationshipsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>';

  const stylesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +

    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
    '<font><b/><sz val="11"/><name val="Arial"/><family val="2"/></font>' +
    '</fonts>' +

    '<fills count="3">' +
    '<fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>' +
    '</fills>' +

    '<borders count="2">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' +
    '<border>' +
    '<left style="thin"><color rgb="FFD5DDE5"/></left>' +
    '<right style="thin"><color rgb="FFD5DDE5"/></right>' +
    '<top style="thin"><color rgb="FFD5DDE5"/></top>' +
    '<bottom style="thin"><color rgb="FFD5DDE5"/></bottom>' +
    '<diagonal/>' +
    '</border>' +
    '</borders>' +

    '<cellStyleXfs count="1">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>' +
    '</cellStyleXfs>' +

    '<cellXfs count="2">' +

    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1">' +
    '<alignment vertical="top" wrapText="1"/>' +
    '</xf>' +

    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
    '<alignment vertical="center" wrapText="1"/>' +
    '</xf>' +

    '</cellXfs>' +

    '<cellStyles count="1">' +
    '<cellStyle name="Normal" xfId="0" builtinId="0"/>' +
    '</cellStyles>' +

    '</styleSheet>';

  const worksheetXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +

    `<dimension ref="A1:${lastCell}"/>` +

    '<sheetViews>' +
    '<sheetView workbookViewId="0">' +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
    '</sheetView>' +
    '</sheetViews>' +

    '<sheetFormatPr defaultRowHeight="15"/>' +

    '<cols>' +
    '<col min="1" max="1" width="18" customWidth="1"/>' +
    '<col min="2" max="2" width="40" customWidth="1"/>' +
    '<col min="3" max="3" width="32" customWidth="1"/>' +
    '<col min="4" max="4" width="14" customWidth="1"/>' +
    '<col min="5" max="5" width="28" customWidth="1"/>' +
    '<col min="6" max="6" width="25" customWidth="1"/>' +
    '<col min="7" max="7" width="55" customWidth="1"/>' +
    '</cols>' +

    `<sheetData>${worksheetRowsXml}</sheetData>` +

    `<autoFilter ref="A1:${lastCell}"/>` +

    '</worksheet>';

  const xlsxFiles = [
    Utilities.newBlob(
      contentTypesXml,
      'application/xml',
      '[Content_Types].xml'
    ),

    Utilities.newBlob(
      rootRelationshipsXml,
      'application/xml',
      '_rels/.rels'
    ),

    Utilities.newBlob(
      workbookXml,
      'application/xml',
      'xl/workbook.xml'
    ),

    Utilities.newBlob(
      workbookRelationshipsXml,
      'application/xml',
      'xl/_rels/workbook.xml.rels'
    ),

    Utilities.newBlob(
      worksheetXml,
      'application/xml',
      'xl/worksheets/sheet1.xml'
    ),

    Utilities.newBlob(
      stylesXml,
      'application/xml',
      'xl/styles.xml'
    )
  ];

  const zippedWorkbook = Utilities.zip(xlsxFiles);

  let safeSupplierName = String(supplierName || 'supplier')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 60);

  if (!safeSupplierName) safeSupplierName = 'supplier';

  const fileName =
    `Late_actions_${safeSupplierName}_${rows.length}.xlsx`;

  return Utilities.newBlob(
    zippedWorkbook.getBytes(),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    fileName
  );
}

function refreshBigQueryData() {
  const bus = Object.keys(BU_CONFIG);

  for (let i = 0; i < bus.length; i++) {
    let bu = bus[i];
    let dataset = BU_CONFIG[bu].dataset;

    // PM and purchasing specialist columns exist only in the Polish dataset.
    let internalCcFields =
      bu === 'PL'
        ? `
          a.pmMailAddress,
          a.specMailAddress
        `
        : `
          CAST(NULL AS STRING) AS pmMailAddress,
          CAST(NULL AS STRING) AS specMailAddress
        `;

    let sql = `
      SELECT
        a.Intervention_Number,
        a.BU_EN_of_action,
        a.num_ray,
        a.lib_ray,
        a.product_code,
        a.produit_description,
        a.supplier_name,
        CAST(a.Creation_date AS STRING) AS Create_date,
        a.Action_Type,
        a.Status_of_Action,
        b.doc_libtrad AS Document_Name,
        CAST(b.top_uploaded_document AS STRING) AS doc_status,
        c.emails,
        a.category_of_action,
        a.Product_conformity_status,
        ${internalCcFields}

      FROM \`${PROJECT_ID}.${dataset}.mailingLateActions\` a

      LEFT JOIN \`${PROJECT_ID}.${dataset}.mailingSupplierDocumentList\` b
        ON a.interv_id = b.interv_id

      LEFT JOIN (
        SELECT
          fourn_id,
          STRING_AGG(DISTINCT contact_mail, ', ') AS emails
        FROM \`${PROJECT_ID}.${dataset}.mailingSupplierLateContact\`
        GROUP BY fourn_id
      ) c
        ON a.fourn_id = c.fourn_id

      WHERE
        a.lib_ray IS NOT NULL
        AND a.supplier_name IS NOT NULL
    `;

    try {
      console.log(`[START] Fetching BQ Data for BU: ${bu}`);

      let queryRequest = {
        query: sql,
        useLegacySql: false,
        useQueryCache: false,
        maxResults: 5000
      };

      let res = BigQuery.Jobs.query(queryRequest, PROJECT_ID);
      let jobId = res.jobReference.jobId;
      let allData = [];
      let totalRows = 0;

      while (true) {
        if (res.rows && res.rows.length > 0) {
          let data = res.rows.map(row =>
            row.f.map(col => (col.v !== null ? String(col.v) : ''))
          );

          for (let r = 0; r < data.length; r++) {
            allData.push(data[r]);
          }

          totalRows += data.length;
        }

        if (res.pageToken) {
          let nextToken = res.pageToken;
          res = null;

          res = BigQuery.Jobs.getQueryResults(
            PROJECT_ID,
            jobId,
            {
              pageToken: nextToken,
              maxResults: 5000
            }
          );
        } else {
          break;
        }
      }

      saveJson(`data_${bu}.json`, allData);

      console.log(
        `[SUCCESS] Saved ${totalRows} total rows to Google Drive for ${bu}.`
      );

      allData = null;

    } catch (e) {
      console.error(
        `[ERROR] BIGQUERY SYNC FAILED FOR ${bu}: ` + e.toString()
      );
    }
  }
}

function getAllData() {
  try {
    let role = getUserRole();
    let bu = role.bu;

    let rawData = loadJson(`data_${bu}.json`, []);
    let logMapRaw = loadJson(`logs_${bu}.json`, {});

    if (rawData.length > 0) {
      let groupedMap = new Map();

      rawData.forEach(row => {
        let intervNum = row[0];

        if (!groupedMap.has(intervNum)) {
          let history = logMapRaw[intervNum] || [0, '-', '-'];

          let deptRaw = String(row[2]).trim();

          let deptDisplay =
            deptRaw !== '' && deptRaw !== 'null'
              ? `${deptRaw.padStart(2, '0')} - ${row[3]}`
              : row[3];

          groupedMap.set(intervNum, [
            intervNum,          // 0: Intervention number
            row[1],             // 1: BU_EN_of_action
            deptDisplay,        // 2: Department
            row[4],             // 3: Product code
            row[5],             // 4: Product name
            row[6],             // 5: Supplier name
            row[7] ? row[7].substring(0, 10) : '', // 6: Create date
            row[8],             // 7: Action type
            row[9],             // 8: Status
            row[12],            // 9: Supplier emails
            row[13] || '-',     // 10: Category
            row[14] || '-',     // 11: Conformity
            [],                 // 12: Documents array
            history[0],         // 13: Draft count
            history[1],         // 14: Last language
            history[2],         // 15: Last date
            row[15] || '',      // 16: PM email
            row[16] || ''       // 17: Purchasing specialist email
          ]);
        }

        if (row[10] !== '') {
          groupedMap.get(intervNum)[12].push([
            row[10],
            row[11]
          ]);
        }
      });

      let finalPayload =
        JSON.stringify(Array.from(groupedMap.values()));

      return {
        success: true,
        dataStr: finalPayload
      };
    }

    return {
      success: true,
      dataStr: '[]'
    };

  } catch (e) {
    return {
      success: false,
      error: e.toString()
    };
  }
}

function generateDrafts(langId, dataArray) {
  if (!dataArray || dataArray.length === 0) {
    throw new Error('No data provided.');
  }

  let role = getUserRole();
  let bu = role.bu;
  let config = BU_CONFIG[bu];

  let props =
    PropertiesService.getScriptProperties().getProperties();

  let langConfig =
    config.languages.find(language => language.id === langId) ||
    config.languages[0];

  let propKeySubj =
    langId === 'LOCAL'
      ? `${bu}_subjLocal`
      : langId === 'EN'
        ? `${bu}_subjEN`
        : `${bu}_subj_${langId}`;

  let propKeyBody =
    langId === 'LOCAL'
      ? `${bu}_bodyLocal`
      : langId === 'EN'
        ? `${bu}_bodyEN`
        : `${bu}_body_${langId}`;

  const subject =
    props[propKeySubj] || langConfig.defSubj;

  const bodyText =
    props[propKeyBody] || langConfig.defBody;

  const languageContent =
  getDraftLanguageContent(
    bu,
    langId,
    config
  );

const headers =
  languageContent.headers;

const emptyDocText =
  languageContent.emptyDoc;

const xlsxNoticeTitle =
  languageContent.xlsxNoticeTitle;

const xlsxNoticeCount =
  languageContent.xlsxNoticeCount;

// This value belongs only to the current user.
const xlsxThreshold =
  getUserXlsxThreshold();

  let groupedBySupp = new Map();

  dataArray.forEach(row => {
    if (!groupedBySupp.has(row.supp)) {
      groupedBySupp.set(row.supp, {
        emails: row.contactEmails,
        rows: [],
        ccEmails: new Set()
      });
    }

    const supplierGroup =
      groupedBySupp.get(row.supp);

    supplierGroup.rows.push(row);

    // New CC rules are used only in the Polish application/database.
    if (bu === 'PL') {
      const productCountry =
        String(row.bu || '')
          .trim()
          .toUpperCase();

      // Polish products:
      // add the PM and purchasing specialist assigned to the product.
      if (
        productCountry ===
        'LEROY MERLIN POLAND'
      ) {
        addCcAddresses(
          supplierGroup.ccEmails,
          row.pmMailAddress
        );

        addCcAddresses(
          supplierGroup.ccEmails,
          row.specMailAddress
        );
      }

      // Romanian products:
      // add only the fixed Romanian CC contact.
      else if (
        productCountry ===
        'LEROY MERLIN ROMANIA'
      ) {
        supplierGroup.ccEmails.add(
          'roxana-elena.simionovici@leroymerlin.ro'
        );
      }
    }
  });

  groupedBySupp.forEach((suppData, suppName) => {
    let html =
      '<div style="' +
      'font-family:Arial,sans-serif;' +
      'font-size:13px;' +
      'white-space:pre-wrap;' +
      'line-height:1.2;' +
      '">';

    html +=
      escapeHtml(bodyText).replace(/\n/g, '<br>');

    html += '</div><br>';

    const useXlsxAttachment =
      suppData.rows.length > xlsxThreshold;

    if (useXlsxAttachment) {
  const translatedCountNotice =
    xlsxNoticeCount.replace(
      '{count}',
      String(suppData.rows.length)
    );

  html +=
    '<div style="' +
    'font-family:Arial,sans-serif;' +
    'font-size:13px;' +
    'line-height:1.4;' +
    'padding:14px 16px;' +
    'background-color:#F0FDFA;' +
    'border-left:4px solid #12A398;' +
    'border-radius:6px;' +
    'color:#1E293B;' +
    '">' +

    '<strong>' +
    escapeHtml(xlsxNoticeTitle) +
    '</strong>' +

    '<br>' +

    '<span style="' +
    'font-size:12px;' +
    'color:#64748B;' +
    '">' +

    escapeHtml(translatedCountNotice) +

    '</span>' +

    '</div>';

    } else {
      html +=
        '<table ' +
        'border="1" ' +
        'cellspacing="0" ' +
        'cellpadding="0" ' +
        'style="' +
        'border-collapse:collapse;' +
        'font-family:Arial,sans-serif;' +
        'font-size:12px;' +
        'line-height:1.2;' +
        'width:100%;' +
        '">' ;

      html += '<tr>';

      headers.forEach(header => {
        html +=
          '<th style="' +
          'padding:6px 10px;' +
          'background-color:#f3f3f3;' +
          'color:#3D5363;' +
          'text-align:left;' +
          '">' +
          escapeHtml(header) +
          '</th>';
      });

      html += '</tr>';

      suppData.rows.forEach(val => {
        let docsString =
          emptyDocText;

        if (val.docs.length > 0) {
          docsString = val.docs
            .map(document => {
              const uploadStatus =
                String(document.uploaded)
                  .trim()
                  .toLowerCase();

              const color =
                uploadStatus === '0' ||
                uploadStatus === 'false' ||
                uploadStatus === 'null' ||
                uploadStatus === ''
                  ? '#E74C3C'
                  : '#2C3E50';

              return (
                `<span style="color:${color};font-weight:600;">` +
                `&bull; ${escapeHtml(document.name)}` +
                '</span>'
              );
            })
            .join('<br>');
        }

        html += '<tr>';

        [
          val.code,
          val.name,
          val.supp,
          val.date,
          val.type,
          val.status
        ].forEach(cell => {
          html +=
            '<td style="' +
            'padding:6px 10px;' +
            'vertical-align:top;' +
            '">' +
            escapeHtml(cell) +
            '</td>';
        });

        html +=
          '<td style="' +
          'padding:6px 10px;' +
          'vertical-align:top;' +
          '">' +
          docsString +
          '</td>';

        html += '</tr>';
      });

      html += '</table>';
    }

    let recipient =
      (
        suppData.emails &&
        suppData.emails !== 'No contact available' &&
        suppData.emails !== 'Brak adresu email'
      )
        ? suppData.emails
        : '';

    let draftOptions = {
      htmlBody: html
    };

    let ccRecipients =
      Array.from(suppData.ccEmails).join(', ');

    if (ccRecipients) {
      draftOptions.cc = ccRecipients;
    }

    if (useXlsxAttachment) {
      const xlsxAttachment =
  createActionsXlsxAttachment(
    suppName,
    suppData.rows,
    headers,
    emptyDocText
  );

      draftOptions.attachments = [
        xlsxAttachment
      ];
    }

    GmailApp.createDraft(
      recipient,
      subject,
      '',
      draftOptions
    );
  });

  let lock =
    LockService.getScriptLock();

  let todayStr = '';

  let logLang =
    langId === 'LOCAL'
      ? bu
      : langId;

  let interventions =
    dataArray.map(item => String(item.interv));

  try {
    lock.waitLock(15000);

    let safeLogMap =
      loadJson(`logs_${bu}.json`, {});

    let today = new Date();

    today.setMinutes(
      today.getMinutes() -
      today.getTimezoneOffset()
    );

    todayStr =
      today.toISOString().substring(0, 10);

    interventions.forEach(intervention => {
      let currentCount =
        safeLogMap[intervention]
          ? Number(
              safeLogMap[intervention][0]
            ) || 0
          : 0;

      safeLogMap[intervention] = [
        currentCount + 1,
        logLang,
        todayStr
      ];
    });

    saveJson(
      `logs_${bu}.json`,
      safeLogMap
    );

  } catch (e) {
    console.error(
      'Lock timeout. Drafts sent, but logs might not be perfectly synced: ' +
      e
    );

    let backupDate = new Date();

    backupDate.setMinutes(
      backupDate.getMinutes() -
      backupDate.getTimezoneOffset()
    );

    todayStr =
      backupDate.toISOString().substring(0, 10);

  } finally {
    lock.releaseLock();
  }

  try {
    let auditFile =
      getDbFile('audit_logs.json');

    let auditText =
      auditFile.getBlob().getDataAsString();

    let auditData =
      auditText
        ? JSON.parse(auditText)
        : [];

    if (!Array.isArray(auditData)) {
      auditData = [];
    }

    auditData.push({
      date: todayStr,
      user: role.email,
      bu: bu,
      drafts: groupedBySupp.size,
      // ADD THIS LINE to save an array of supplier names
      suppliers: Array.from(groupedBySupp.keys()) 
    });

    auditFile.setContent(
      JSON.stringify(auditData)
    );

  } catch (e) {
    console.error(
      'Audit log failed to save: ' + e
    );
  }

  return {
    success: true,
    updatedInterventions: interventions,
    date: todayStr,
    lang: logLang,
    draftsCreated: groupedBySupp.size
  };
}
