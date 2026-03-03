const { PDFDocument } = window.PDFLib || {};

const STORAGE_LANG_KEY = 'interleavepdf_lang';

const I18N = {
  pl: {
    metaTitle: 'InterleavePDF - Naprzemienne laczenie stron PDF',
    metaDescription: 'Polacz dwa PDF-y naprzemiennie bez wysylania plikow na serwer.',
    languageSelector: 'Wybierz jezyk',
    badge: '100% lokalnie w przegladarce',
    repoLink: 'Repozytorium GitHub',
    subtitle:
      'Polacz dwa skany w jeden plik: strony A/B beda przeplatane, bez wysylania dokumentow na serwer.',
    uploadsTitle: 'Dodaj dwa pliki PDF',
    dropHint: 'Przeciagnij plik tutaj lub kliknij',
    noFile: 'Nie wybrano pliku',
    optionsTitle: 'Ustawienia przeplotu',
    startPrompt: 'Ktory plik ma byc pierwszy?',
    startA: 'Zacznij od PDF A',
    startB: 'Zacznij od PDF B',
    reversePrompt: 'Opcjonalnie odwroc kolejnosc stron (przydatne po drugim skanie):',
    reverseA: 'Odwroc strony w PDF A',
    reverseB: 'Odwroc strony w PDF B',
    mergeBtn: 'Polacz i pobierz PDF',
    statusSelectBoth: 'Wybierz oba pliki, aby kontynuowac.',
    statusLibError: 'Nie udalo sie zaladowac biblioteki PDF. Odswiez strone i sprobuj ponownie.',
    statusInvalidPdf: 'Plik {label} nie jest PDF-em. Wybierz poprawny dokument.',
    statusLoading: 'Wczytywanie PDF {label}...',
    statusReadError:
      'Nie udalo sie odczytac PDF {label}. Sprawdz, czy plik nie jest uszkodzony lub zaszyfrowany.',
    statusReady: 'Gotowe: PDF A ({a} stron) i PDF B ({b} stron).',
    statusMerging: 'Laczenie stron naprzemiennie...',
    statusMergeError: 'Nie udalo sie polaczyc plikow PDF. Sprobuj ponownie.',
    statusDone: 'Gotowe. Polaczono {count} stron do pliku: {filename}',
    fileMeta: '{name} · {pages} stron · {size} MB',
    outputPrefix: 'przeplot',
  },
  en: {
    metaTitle: 'InterleavePDF - Alternate PDF Page Merger',
    metaDescription: 'Merge two PDFs by alternating pages without uploading files to any server.',
    languageSelector: 'Language selector',
    badge: '100% local in your browser',
    repoLink: 'GitHub Repository',
    subtitle:
      'Merge two scans into one file: A/B pages will be interleaved, with no document upload to any server.',
    uploadsTitle: 'Add two PDFs',
    dropHint: 'Drag a file here or click',
    noFile: 'No file selected',
    optionsTitle: 'Interleave settings',
    startPrompt: 'Which file should start first?',
    startA: 'Start with PDF A',
    startB: 'Start with PDF B',
    reversePrompt: 'Optionally reverse page order (useful after the second scan):',
    reverseA: 'Reverse pages in PDF A',
    reverseB: 'Reverse pages in PDF B',
    mergeBtn: 'Merge and download PDF',
    statusSelectBoth: 'Select both files to continue.',
    statusLibError: 'Could not load the PDF library. Refresh the page and try again.',
    statusInvalidPdf: 'File {label} is not a PDF. Please choose a valid document.',
    statusLoading: 'Loading PDF {label}...',
    statusReadError:
      'Could not read PDF {label}. Check if the file is damaged or encrypted.',
    statusReady: 'Ready: PDF A ({a} pages) and PDF B ({b} pages).',
    statusMerging: 'Merging pages alternately...',
    statusMergeError: 'Could not merge the PDF files. Please try again.',
    statusDone: 'Done. Merged {count} pages into: {filename}',
    fileMeta: '{name} · {pages} pages · {size} MB',
    outputPrefix: 'interleave',
  },
};

const state = {
  fileA: null,
  fileB: null,
  bufferA: null,
  bufferB: null,
  pagesA: 0,
  pagesB: 0,
  busy: false,
  lang: 'en',
  statusKey: 'statusSelectBoth',
  statusVars: {},
  statusLevel: 'warn',
};

const el = {
  fileInputA: document.getElementById('fileInputA'),
  fileInputB: document.getElementById('fileInputB'),
  dropZoneA: document.getElementById('dropZoneA'),
  dropZoneB: document.getElementById('dropZoneB'),
  fileMetaA: document.getElementById('fileMetaA'),
  fileMetaB: document.getElementById('fileMetaB'),
  reverseA: document.getElementById('reverseA'),
  reverseB: document.getElementById('reverseB'),
  mergeBtn: document.getElementById('mergeBtn'),
  statusText: document.getElementById('statusText'),
  metaDescription: document.getElementById('metaDescription'),
  langButtons: Array.from(document.querySelectorAll('.lang-btn')),
  i18nNodes: Array.from(document.querySelectorAll('[data-i18n]')),
  i18nAriaNodes: Array.from(document.querySelectorAll('[data-i18n-aria-label]')),
};

init();

function init() {
  setupLanguage();

  if (!PDFDocument) {
    setStatusByKey('statusLibError', 'error');
    return;
  }

  setupDropZone('A', el.dropZoneA, el.fileInputA);
  setupDropZone('B', el.dropZoneB, el.fileInputB);

  el.mergeBtn.addEventListener('click', mergePdfs);
  refreshFileMeta();
  refreshUiState();
  setStatusByKey('statusSelectBoth', 'warn');
}

function setupLanguage() {
  const storedLang = readStoredLang();
  const initialLang = normalizeLang(storedLang || detectBrowserLang());
  setLanguage(initialLang, false);

  el.langButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setLanguage(button.dataset.lang, true);
    });
  });
}

function setLanguage(lang, persist) {
  state.lang = normalizeLang(lang);

  if (persist) {
    persistLang(state.lang);
  }

  document.documentElement.lang = state.lang;
  document.title = t('metaTitle');
  if (el.metaDescription) {
    el.metaDescription.content = t('metaDescription');
  }

  for (const node of el.i18nNodes) {
    node.textContent = t(node.dataset.i18n);
  }

  for (const node of el.i18nAriaNodes) {
    node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
  }

  updateLanguageButtons();
  refreshFileMeta();
  renderStatus();
}

function updateLanguageButtons() {
  el.langButtons.forEach((button) => {
    const active = button.dataset.lang === state.lang;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function normalizeLang(value) {
  if (!value) {
    return 'en';
  }

  return value.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

function detectBrowserLang() {
  if (Array.isArray(navigator.languages) && navigator.languages.length > 0) {
    return navigator.languages[0];
  }

  return navigator.language || 'en';
}

function readStoredLang() {
  try {
    return localStorage.getItem(STORAGE_LANG_KEY);
  } catch {
    return null;
  }
}

function persistLang(lang) {
  try {
    localStorage.setItem(STORAGE_LANG_KEY, lang);
  } catch {
    // Ignore storage errors so language switching still works in-memory.
  }
}

function setupDropZone(label, dropZone, fileInput) {
  fileInput.addEventListener('change', async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    await loadFile(label, file);
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('is-dragging');
    });
  });

  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('is-dragging');
    });
  });

  dropZone.addEventListener('drop', async (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (!file) {
      return;
    }

    fileInput.files = event.dataTransfer.files;
    await loadFile(label, file);
  });
}

async function loadFile(label, file) {
  if (!isPdf(file)) {
    setStatusByKey('statusInvalidPdf', 'error', { label });
    return;
  }

  try {
    setStatusByKey('statusLoading', 'warn', { label });
    const buffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buffer);
    const pageCount = pdf.getPageCount();

    if (label === 'A') {
      state.fileA = file;
      state.bufferA = buffer;
      state.pagesA = pageCount;
    } else {
      state.fileB = file;
      state.bufferB = buffer;
      state.pagesB = pageCount;
    }

    setStatusByKey('statusReady', 'ok', {
      a: state.pagesA || 0,
      b: state.pagesB || 0,
    });
  } catch (error) {
    if (label === 'A') {
      resetFileA();
    } else {
      resetFileB();
    }

    setStatusByKey('statusReadError', 'error', { label });
    console.error(error);
  } finally {
    refreshFileMeta();
    refreshUiState();
  }
}

function refreshFileMeta() {
  refreshSingleFileMeta(state.fileA, state.pagesA, el.fileMetaA);
  refreshSingleFileMeta(state.fileB, state.pagesB, el.fileMetaB);
}

function refreshSingleFileMeta(file, pages, target) {
  if (!target) {
    return;
  }

  if (!file || !pages) {
    target.textContent = t('noFile');
    return;
  }

  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  target.textContent = t('fileMeta', {
    name: file.name,
    pages,
    size: sizeMB,
  });
}

function refreshUiState() {
  const ready = Boolean(state.bufferA && state.bufferB && !state.busy);
  el.mergeBtn.disabled = !ready;
}

async function mergePdfs() {
  if (!state.bufferA || !state.bufferB || state.busy) {
    return;
  }

  state.busy = true;
  refreshUiState();
  setStatusByKey('statusMerging', 'warn');

  try {
    const startWith = document.querySelector('input[name="startWith"]:checked')?.value || 'A';
    const reverseA = el.reverseA.checked;
    const reverseB = el.reverseB.checked;

    const sourceA = await PDFDocument.load(state.bufferA);
    const sourceB = await PDFDocument.load(state.bufferB);
    const output = await PDFDocument.create();

    const indicesA = makeIndices(sourceA.getPageCount(), reverseA);
    const indicesB = makeIndices(sourceB.getPageCount(), reverseB);

    const pagesAdded = await appendAlternating({
      output,
      sourceA,
      sourceB,
      indicesA,
      indicesB,
      startWith,
    });

    if (!pagesAdded) {
      throw new Error('No pages to merge.');
    }

    const mergedBytes = await output.save();
    const filename = buildOutputName(state.fileA?.name, state.fileB?.name);
    triggerDownload(mergedBytes, filename);

    setStatusByKey('statusDone', 'ok', { count: pagesAdded, filename });
  } catch (error) {
    setStatusByKey('statusMergeError', 'error');
    console.error(error);
  } finally {
    state.busy = false;
    refreshUiState();
  }
}

function makeIndices(count, reverse) {
  const indices = Array.from({ length: count }, (_, i) => i);
  return reverse ? indices.reverse() : indices;
}

async function appendAlternating({
  output,
  sourceA,
  sourceB,
  indicesA,
  indicesB,
  startWith,
}) {
  let iA = 0;
  let iB = 0;
  let current = startWith;
  let added = 0;

  while (iA < indicesA.length || iB < indicesB.length) {
    if (current === 'A') {
      if (iA < indicesA.length) {
        const [page] = await output.copyPages(sourceA, [indicesA[iA]]);
        output.addPage(page);
        iA += 1;
        added += 1;
      } else if (iB < indicesB.length) {
        const [page] = await output.copyPages(sourceB, [indicesB[iB]]);
        output.addPage(page);
        iB += 1;
        added += 1;
      }
      current = 'B';
      continue;
    }

    if (iB < indicesB.length) {
      const [page] = await output.copyPages(sourceB, [indicesB[iB]]);
      output.addPage(page);
      iB += 1;
      added += 1;
    } else if (iA < indicesA.length) {
      const [page] = await output.copyPages(sourceA, [indicesA[iA]]);
      output.addPage(page);
      iA += 1;
      added += 1;
    }

    current = 'A';
  }

  return added;
}

function buildOutputName(nameA, nameB) {
  const cleanA = sanitizeBaseName(nameA || 'pdf-a');
  const cleanB = sanitizeBaseName(nameB || 'pdf-b');
  const prefix = sanitizeBaseName(t('outputPrefix') || 'interleave');
  return `${prefix}-${cleanA}-${cleanB}.pdf`;
}

function sanitizeBaseName(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function triggerDownload(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function isPdf(file) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function setStatusByKey(key, level = 'warn', vars = {}) {
  state.statusKey = key;
  state.statusVars = vars;
  state.statusLevel = level;
  renderStatus();
}

function renderStatus() {
  el.statusText.textContent = t(state.statusKey, state.statusVars);
  el.statusText.dataset.level = state.statusLevel;
}

function t(key, vars = {}) {
  const dictionary = I18N[state.lang] || I18N.en;
  const template = dictionary[key] || I18N.en[key] || key;

  return template.replace(/\{(\w+)\}/g, (_, token) => {
    const value = vars[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

function resetFileA() {
  state.fileA = null;
  state.bufferA = null;
  state.pagesA = 0;
}

function resetFileB() {
  state.fileB = null;
  state.bufferB = null;
  state.pagesB = 0;
}
