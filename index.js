// ============================================================================
// Temas visuales
// ============================================================================

/** Obtiene el tema válido guardado o usa el tema cálido por defecto. */
function loadTheme() {
    try {
        const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        currentTheme = THEMES.some((theme) => theme.id === savedTheme) ? savedTheme : "warm";
    } catch (error) {
        currentTheme = "warm";
    }

    applyTheme();
}

/** Aplica el tema seleccionado y actualiza el icono de acceso rápido. */
function applyTheme() {
    const theme = THEMES.find((item) => item.id === currentTheme) || THEMES[0];
    document.documentElement.dataset.theme = theme.id;
    elements.themeButton.setAttribute("aria-label", `Tema: ${theme.label}. Cambiar tema`);
    elements.themeButton.title = `Tema: ${theme.label}`;
    elements.themeIcon.className = `bi ${theme.icon}`;

    const browserThemeColor = theme.id === "night" ? "#18201f"
        : theme.id === "sage" ? "#eef1e7" : "#f3e9d2";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", browserThemeColor);
}

/** Cambia al siguiente tema y conserva la preferencia del usuario. */
function cycleTheme() {
    const index = THEMES.findIndex((theme) => theme.id === currentTheme);
    currentTheme = THEMES[(index + 1) % THEMES.length].id;

    try {
        localStorage.setItem(THEME_STORAGE_KEY, currentTheme);
    } catch (error) {
        // El tema seguirá activo aunque el navegador impida guardar preferencias.
    }

    applyTheme();
}

// ============================================================================
// Configuración y referencias del DOM
// ============================================================================

// Ruta del archivo que contiene todos los versículos de la Biblia.
const DATA_URL = "Biblia.json";

// Tiempo (en milisegundos) que permanece visible el mensaje de compartir.
const FEEDBACK_DURATION = 3000;

// Cantidad máxima de resultados por página en la concordancia.
const SEARCH_PAGE_SIZE = 10;

// Mínimo de caracteres aceptados en una búsqueda.
const MIN_SEARCH_LENGTH = 2;

// Máximo de favoritos y cantidad mostrada por página.
const MAX_FAVORITES = 10;
const FAVORITES_PAGE_SIZE = 5;

// Clave usada para persistir los índices de los versículos favoritos.
const FAVORITES_STORAGE_KEY = "randomVerseFavorites";

// Temas visuales disponibles y clave usada para recordar el seleccionado.
const THEME_STORAGE_KEY = "randomVerseTheme";
const THEMES = [
    { id: "warm", label: "Claro cálido", icon: "bi-sun" },
    { id: "sage", label: "Verde suave", icon: "bi-tree" },
    { id: "night", label: "Noche", icon: "bi-moon-stars" }
];

// Referencias a los elementos de index.html que se actualizan desde este archivo.
const elements = {
    container: document.getElementById("verse-container"),
    reference: document.getElementById("verse-reference"),
    text: document.getElementById("verse-text"),
    title: document.getElementById("verse-title"),
    error: document.getElementById("verse-error"),
    button: document.getElementById("refresh-button"),
    icon: document.getElementById("refresh-icon"),
    label: document.getElementById("refresh-label"),
    shareButton: document.getElementById("share-button"),
    shareFeedback: document.getElementById("share-feedback"),
    shareWhatsApp: document.getElementById("share-whatsapp"),
    shareTelegram: document.getElementById("share-telegram"),
    shareFacebook: document.getElementById("share-facebook"),
    shareX: document.getElementById("share-x"),
    shareEmail: document.getElementById("share-email"),
    copyVerse: document.getElementById("copy-verse"),
    favoriteButton: document.getElementById("favorite-button"),
    favoriteIcon: document.getElementById("favorite-icon"),
    favoritesCount: document.getElementById("favorites-count"),
    favoritesSummary: document.getElementById("favorites-summary"),
    favoritesEmpty: document.getElementById("favorites-empty"),
    favoritesList: document.getElementById("favorites-list"),
    favoritesPaginationNav: document.getElementById("favorites-pagination-nav"),
    favoritesPagination: document.getElementById("favorites-pagination"),
    chapterButton: document.getElementById("chapter-button"),
    chapterIcon: document.getElementById("chapter-icon"),
    chapterLabel: document.getElementById("chapter-label"),
    chapterContainer: document.getElementById("chapter-container"),
    chapterTitle: document.getElementById("chapter-title"),
    chapterVerses: document.getElementById("chapter-verses"),
    chapterShrink: document.getElementById("chapter-shrink"),
    chapterGrow: document.getElementById("chapter-grow"),
    status: document.getElementById("verse-status"),
    themeButton: document.getElementById("theme-button"),
    themeIcon: document.getElementById("theme-icon"),
    searchForm: document.getElementById("concordance-form"),
    searchInput: document.getElementById("concordance-input"),
    searchButton: document.getElementById("concordance-search-button"),
    searchMessage: document.getElementById("concordance-message"),
    searchResults: document.getElementById("concordance-results"),
    searchCount: document.getElementById("concordance-count"),
    searchTbody: document.getElementById("concordance-tbody"),
    paginationNav: document.getElementById("concordance-pagination-nav"),
    pagination: document.getElementById("concordance-pagination"),
};

// Estado de la aplicación.
let verses = [];          // Lista completa de versículos cargados desde el JSON.
let currentIndex = -1;    // Posición del versículo actual dentro de `verses`.
let currentVerse = null;  // Objeto del versículo que se está mostrando.
let feedbackTimer = null; // Temporizador para ocultar el mensaje de compartir.
let searchResults = [];   // Índices de los versículos que coinciden con la búsqueda.
let searchPage = 1;       // Página actual de resultados (empieza en 1).
let currentQuery = "";    // Último texto buscado, para mostrarlo en el resumen.
let favoriteIndexes = new Set(); // Índices de los versículos guardados como favoritos.
let favoritesPage = 1;        // Página actual de la lista de favoritos.
let chapterFontSize = 1;      // Multiplicador del texto mostrado del capítulo.
let currentTheme = "warm";    // Tema visual activo.

// ============================================================================
// Utilidades
// ============================================================================

/**
 * Devuelve un índice aleatorio entre 0 y `total - 1`.
 * Si hay más de un elemento, evita devolver `excludedIndex` para que el mismo
 * versículo no se repita de forma consecutiva.
 */
function randomIndex(total, excludedIndex) {
    if (total <= 1) {
        return 0;
    }

    let index = Math.floor(Math.random() * total);

    while (index === excludedIndex) {
        index = Math.floor(Math.random() * total);
    }

    return index;
}

/** Construye la referencia bíblica, por ejemplo: "Salmos 23:1". */
function formatReference(verse) {
    return `${verse.Book} ${verse.Chapter}:${verse.Verse}`;
}

/** Quita acentos y pasa a minúsculas para comparar búsquedas. */
function normalizeText(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

/** Escapa caracteres especiales antes de insertar datos del JSON en el HTML. */
function escapeHtml(value) {
    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    };

    return String(value).replace(/[&<>"']/g, (character) => entities[character]);
}

/** Activa o desactiva el formulario de la concordancia mientras carga la Biblia. */
function setSearchEnabled(isEnabled) {
    elements.searchInput.disabled = !isEnabled;
    elements.searchButton.disabled = !isEnabled;
}

/**
 * Activa o desactiva el estado de carga de los botones de acción.
 * Mientras se carga la Biblia, actualizar, compartir y buscar quedan bloqueados.
 */
function setLoading(isLoading) {
    elements.button.disabled = isLoading;

    if (isLoading) {
        elements.shareButton.disabled = true;
        elements.favoriteButton.disabled = true;
        elements.chapterButton.disabled = true;
        setSearchEnabled(false);
    }

    // El icono se convierte en un spinner mientras se obtienen los datos.
    elements.icon.className = isLoading
        ? "spinner-border spinner-border-sm me-2"
        : "bi bi-arrow-clockwise me-2";
    elements.label.textContent = isLoading
        ? "Cargando…"
        : "Actualizar";
}

/** Muestra un mensaje temporal debajo de los botones de acción. */
function showShareFeedback(message, type) {
    clearTimeout(feedbackTimer);

    elements.shareFeedback.textContent = message;
    elements.shareFeedback.classList.remove("is-success", "is-error");
    elements.shareFeedback.classList.add(type === "error" ? "is-error" : "is-success");

    feedbackTimer = setTimeout(() => {
        elements.shareFeedback.textContent = "";
        elements.shareFeedback.classList.remove("is-success", "is-error");
    }, FEEDBACK_DURATION);
}

/** Borra el mensaje de compartir al cambiar de versículo. */
function clearShareFeedback() {
    clearTimeout(feedbackTimer);
    elements.shareFeedback.textContent = "";
    elements.shareFeedback.classList.remove("is-success", "is-error");
}

/** Lee los índices favoritos guardados, descartando datos inválidos. */
function loadFavorites() {
    try {
        const storedFavorites = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");

        favoriteIndexes = new Set(Array.isArray(storedFavorites)
            ? storedFavorites
                .filter((index) => Number.isInteger(index) && index >= 1)
                .slice(-MAX_FAVORITES)
            : []);
    } catch (error) {
        console.warn("No se pudieron recuperar los favoritos:", error);
        favoriteIndexes = new Set();
    }

    renderFavorites();
}

/** Guarda la colección actual de favoritos en el almacenamiento local. */
function saveFavorites() {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favoriteIndexes].sort((a, b) => a - b)));
    } catch (error) {
        console.error("No se pudieron guardar los favoritos:", error);
        showShareFeedback("No se pudo guardar el favorito en este navegador.", "error");
    }
}

/** Devuelve el identificador estable usado por el registro de favoritos. */
function getVerseKey(verse) {
    return Number.isInteger(verse.Index) ? verse.Index : verses.indexOf(verse) + 1;
}

/** Actualiza el corazón del versículo mostrado. */
function updateFavoriteButton() {
    if (!currentVerse) {
        elements.favoriteButton.classList.remove("is-favorite");
        elements.favoriteButton.setAttribute("aria-pressed", "false");
        elements.favoriteIcon.className = "bi bi-heart";
        elements.favoriteButton.setAttribute("aria-label", "Guardar versículo como favorito");
        return;
    }

    const isFavorite = favoriteIndexes.has(getVerseKey(currentVerse));
    elements.favoriteButton.classList.toggle("is-favorite", isFavorite);
    elements.favoriteButton.setAttribute("aria-pressed", String(isFavorite));
    elements.favoriteIcon.className = isFavorite ? "bi bi-heart-fill" : "bi bi-heart";
    elements.favoriteButton.setAttribute(
        "aria-label",
        isFavorite ? "Quitar versículo de favoritos" : "Guardar versículo como favorito"
    );
}

/** Alterna el estado favorito del versículo mostrado. */
function toggleCurrentFavorite() {
    if (!currentVerse) {
        return;
    }

    const verseKey = getVerseKey(currentVerse);

    if (favoriteIndexes.has(verseKey)) {
        favoriteIndexes.delete(verseKey);
        favoritesPage = 1;
        showShareFeedback("Versículo eliminado de favoritos.", "success");
    } else {
        if (favoriteIndexes.size >= MAX_FAVORITES) {
            showShareFeedback(`Puedes guardar hasta ${MAX_FAVORITES} favoritos.`, "error");
            return;
        }

        favoriteIndexes.add(verseKey);
        showShareFeedback("Versículo guardado como favorito.", "success");
    }

    saveFavorites();
    updateFavoriteButton();
    renderFavorites();
}

/** Construye el paginador de la lista limitada de favoritos. */
function renderFavoritesPagination(totalPages) {
    if (totalPages <= 1) {
        elements.favoritesPagination.innerHTML = "";
        elements.favoritesPaginationNav.classList.add("d-none");
        return;
    }

    let html = `<li class="page-item ${favoritesPage === 1 ? "disabled" : ""}">
        <button class="page-link" type="button" data-favorites-page="${favoritesPage - 1}"
            aria-label="Página anterior" ${favoritesPage === 1 ? "disabled" : ""}>
            <i class="bi bi-chevron-left" aria-hidden="true"></i>
        </button>
    </li>`;

    for (let page = 1; page <= totalPages; page++) {
        html += `<li class="page-item ${page === favoritesPage ? "active" : ""}">
            <button class="page-link" type="button" data-favorites-page="${page}"
                ${page === favoritesPage ? 'aria-current="page"' : ""}>${page}</button>
        </li>`;
    }

    html += `<li class="page-item ${favoritesPage === totalPages ? "disabled" : ""}">
        <button class="page-link" type="button" data-favorites-page="${favoritesPage + 1}"
            aria-label="Página siguiente" ${favoritesPage === totalPages ? "disabled" : ""}>
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
    </li>`;

    elements.favoritesPagination.innerHTML = html;
    elements.favoritesPaginationNav.classList.remove("d-none");
}

/** Muestra los versos guardados y permite abrirlos o eliminarlos. */
function renderFavorites() {
    const favoriteVerses = [...favoriteIndexes]
        .map((key) => verses.find((verse) => getVerseKey(verse) === key))
        .filter(Boolean);

    const count = favoriteVerses.length;
    const totalPages = Math.ceil(count / FAVORITES_PAGE_SIZE);
    favoritesPage = Math.min(Math.max(favoritesPage, 1), Math.max(totalPages, 1));

    const start = (favoritesPage - 1) * FAVORITES_PAGE_SIZE;
    const pageFavorites = favoriteVerses.slice(start, start + FAVORITES_PAGE_SIZE);

    elements.favoritesCount.textContent = String(count);
    elements.favoritesCount.classList.toggle("d-none", count === 0);
    elements.favoritesSummary.textContent = count === 1
        ? "Tienes 1 versículo favorito de un máximo de 10."
        : `Tienes ${count} versículos favoritos de un máximo de 10.`;
    elements.favoritesEmpty.classList.toggle("d-none", count > 0);
    elements.favoritesList.classList.toggle("d-none", count === 0);

    elements.favoritesList.innerHTML = pageFavorites
        .map((verse) => {
            const verseKey = getVerseKey(verse);
            const reference = escapeHtml(formatReference(verse));
            const text = escapeHtml(verse.Text);

            return `<article class="favorite-item card border-0">
                <div class="card-body d-flex gap-3 align-items-start">
                    <button type="button" class="favorite-open text-start border-0 bg-transparent flex-grow-1 p-0"
                        data-favorite-index="${verseKey}" aria-label="Ver ${reference}">
                        <span class="d-block text-primary fw-semibold mb-1">${reference}</span>
                        <span class="d-block favorite-text">${text}</span>
                    </button>
                    <button type="button" class="btn favorite-remove" data-remove-favorite="${verseKey}"
                        aria-label="Eliminar ${reference} de favoritos" title="Eliminar favorito">
                        <i class="bi bi-heart-fill" aria-hidden="true"></i>
                    </button>
                </div>
            </article>`;
        })
        .join("");

    renderFavoritesPagination(totalPages);
}

/** Cambia de página dentro de los favoritos. */
function handleFavoritesPagination(event) {
    const button = event.target.closest("[data-favorites-page]");

    if (!button || button.disabled) {
        return;
    }

    const totalPages = Math.ceil(favoriteIndexes.size / FAVORITES_PAGE_SIZE);
    const page = Number(button.dataset.favoritesPage);

    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
        return;
    }

    favoritesPage = page;
    renderFavorites();
}

/** Abre un favorito desde la tarjeta de favoritos. */
function openFavorite(event) {
    const openButton = event.target.closest("[data-favorite-index]");

    if (openButton) {
        const verseKey = Number(openButton.dataset.favoriteIndex);
        const index = verses.findIndex((verse) => getVerseKey(verse) === verseKey);

        if (index >= 0) {
            selectVerseByIndex(index);
        }
        return;
    }

    const removeButton = event.target.closest("[data-remove-favorite]");

    if (removeButton) {
        favoriteIndexes.delete(Number(removeButton.dataset.removeFavorite));
        saveFavorites();
        updateFavoriteButton();
        renderFavorites();
    }
}

/** Muestra un mensaje en la sección de concordancia y oculta la tabla. */
function showSearchMessage(message, type) {
    elements.searchMessage.textContent = message;
    elements.searchMessage.className = `alert alert-${type}`;
    elements.searchMessage.classList.remove("d-none");
    elements.searchResults.classList.add("d-none");
    elements.paginationNav.classList.add("d-none");
}

/** Oculta el mensaje de la concordancia. */
function hideSearchMessage() {
    elements.searchMessage.textContent = "";
    elements.searchMessage.classList.add("d-none");
}

// ============================================================================
// Navegación
// ============================================================================

/** Marca como activo el enlace de navegación de la sección indicada. */
function setActiveNav(view) {
    document.querySelectorAll("[data-nav]").forEach((link) => {
        const isActive = link.dataset.nav === view;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

/** Cierra el menú de navegación en pantallas pequeñas después de elegir una opción. */
function closeMobileNav() {
    const collapse = document.getElementById("main-nav");

    if (!collapse || !collapse.classList.contains("show") || !window.bootstrap) {
        return;
    }

    window.bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).hide();
}

/** Desplaza la página hasta una sección, respetando el desplazamiento suave. */
function scrollToSection(id) {
    const section = document.getElementById(id);

    if (section && typeof section.scrollIntoView === "function") {
        section.scrollIntoView({ block: "start" });
    }
}

/** Sincroniza el enlace activo con el hash de la URL (#inicio, #versiculo, #concordancia). */
function syncNavFromHash() {
    const view = window.location.hash.replace("#", "");

    if (["inicio", "versiculo", "favoritos", "concordancia"].includes(view)) {
        setActiveNav(view);
    }
}

// ============================================================================
// Renderizado del versículo
// ============================================================================

/** Pinta en pantalla el versículo recibido y habilita las opciones de compartir. */
function renderVerse(verse) {
    currentVerse = verse;

    elements.reference.textContent = formatReference(verse);
    elements.text.textContent = verse.Text;
    elements.title.textContent = verse.Title ? `Tema: ${verse.Title}` : "";
    elements.error.classList.add("d-none");
    elements.shareButton.disabled = false;
    elements.favoriteButton.disabled = false;
    elements.chapterButton.disabled = false;

    clearChapter();
    clearShareFeedback();
    updateFavoriteButton();
    updateShareLinks(verse);

    // Reinicia la animación para que se aprecie el cambio de versículo.
    elements.container.classList.remove("is-updating");
    void elements.container.offsetWidth;
    elements.container.classList.add("is-updating");

    // Aviso para lectores de pantalla.
    elements.status.textContent = `Versículo mostrado: ${formatReference(verse)}`;
}

/** Muestra un mensaje de error y deja la interfaz sin versículo activo. */
function showError(message) {
    currentVerse = null;
    elements.shareButton.disabled = true;
    elements.favoriteButton.disabled = true;
    elements.chapterButton.disabled = true;
    clearChapter();

    elements.error.textContent = message;
    elements.error.classList.remove("d-none");
    elements.reference.textContent = "No disponible";
    elements.text.textContent = "No se pudo mostrar el versículo.";
    elements.title.textContent = "";
    elements.status.textContent = message;
}

/** Oculta el capítulo completo y restablece el botón de consulta. */
function clearChapter() {
    chapterFontSize = 1;
    elements.chapterVerses.style.fontSize = "";
    elements.chapterShrink.disabled = false;
    elements.chapterGrow.disabled = false;
    elements.chapterContainer.classList.add("d-none");
    elements.chapterContainer.setAttribute("aria-hidden", "true");
    elements.chapterVerses.replaceChildren();
    elements.chapterTitle.textContent = "";
    elements.chapterButton.setAttribute("aria-expanded", "false");
    elements.chapterLabel.textContent = "Leer capítulo";
    elements.chapterIcon.className = "bi bi-journal-text me-2";
}

/** Obtiene y muestra todos los versículos del capítulo del versículo actual. */
function toggleChapter() {
    if (!currentVerse) {
        return;
    }

    if (!elements.chapterContainer.classList.contains("d-none")) {
        clearChapter();
        return;
    }

    const chapterVerses = verses
        .filter((verse) => verse.Book === currentVerse.Book
            && verse.BoookNumber === currentVerse.BoookNumber
            && verse.Chapter === currentVerse.Chapter)
        .sort((first, second) => first.Verse - second.Verse);

    elements.chapterTitle.textContent = `${currentVerse.Book} ${currentVerse.Chapter}`;
    let previousTitle = "";
    elements.chapterVerses.innerHTML = chapterVerses.map((verse) => {
        const title = verse.Title?.trim() || "";
        const titleMarkup = title && title !== previousTitle
            ? `<span class="chapter-verse-title">${escapeHtml(title)}</span>`
            : "";
        previousTitle = title;

        return `<li value="${verse.Verse}">
            ${titleMarkup}
            <button type="button" class="chapter-verse-button" data-chapter-verse="${getVerseKey(verse)}"
                aria-label="Mostrar ${escapeHtml(formatReference(verse))}">${escapeHtml(verse.Text)}</button>
        </li>`;
    }).join("");
    elements.chapterContainer.classList.remove("d-none");
    elements.chapterContainer.setAttribute("aria-hidden", "false");
    elements.chapterButton.setAttribute("aria-expanded", "true");
    elements.chapterLabel.textContent = "Ocultar capítulo";
    elements.chapterIcon.className = "bi bi-chevron-up me-2";

    elements.chapterContainer.scrollIntoView({ block: "nearest" });
}

/** Muestra en la tarjeta principal el versículo elegido dentro del capítulo. */
function selectChapterVerse(event) {
    const button = event.target.closest("[data-chapter-verse]");

    if (!button) {
        return;
    }

    const verseKey = Number(button.dataset.chapterVerse);
    const index = verses.findIndex((verse) => getVerseKey(verse) === verseKey);

    if (index >= 0) {
        selectVerseByIndex(index);
    }
}

/** Ajusta el tamaño de la letra del capítulo dentro de límites accesibles. */
function resizeChapterText(change) {
    chapterFontSize = Math.min(1.5, Math.max(0.75, chapterFontSize + change));
    elements.chapterVerses.style.fontSize = `${chapterFontSize}rem`;
    elements.chapterShrink.disabled = chapterFontSize <= 0.75;
    elements.chapterGrow.disabled = chapterFontSize >= 1.5;
}

/** Elige un versículo al azar de la lista y lo muestra. */
function showRandomVerse() {
    if (verses.length === 0) {
        return;
    }

    currentIndex = randomIndex(verses.length, currentIndex);
    renderVerse(verses[currentIndex]);
}

// ============================================================================
// Carga de datos
// ============================================================================

/**
 * Descarga y valida Biblia.json.
 * Se ejecuta al abrir la página y de nuevo si el usuario pulsa "Actualizar"
 * cuando la carga inicial falló.
 */
async function loadBible() {
    setLoading(true);
    elements.error.classList.add("d-none");

    try {
        const response = await fetch(DATA_URL);

        if (!response.ok) {
            throw new Error(`Respuesta HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("El archivo de la Biblia está vacío o no es válido.");
        }

        verses = data;
        loadFavorites();
        setLoading(false);
        setSearchEnabled(true);
        showRandomVerse();
    } catch (error) {
        console.error("Error al cargar la Biblia:", error);
        setLoading(false);
        showError(
            "No se pudo cargar la Biblia. Abre el proyecto con un servidor local (por ejemplo, " +
            "«python3 -m http.server») y vuelve a intentarlo."
        );
    }
}

/** Maneja el clic en "Actualizar versículo" (o reintenta la carga si falló). */
function handleRefresh() {
    if (verses.length === 0) {
        loadBible();
        return;
    }

    showRandomVerse();
}

// ============================================================================
// Concordancia
// ============================================================================

/** Construye los botones de paginación para la página actual. */
function renderPagination(totalPages) {
    if (totalPages <= 1) {
        elements.pagination.innerHTML = "";
        elements.paginationNav.classList.add("d-none");
        return;
    }

    const windowSize = 5;
    let firstPage = Math.max(1, searchPage - Math.floor(windowSize / 2));
    let lastPage = Math.min(totalPages, firstPage + windowSize - 1);
    firstPage = Math.max(1, lastPage - windowSize + 1);

    let html = "";
    const previousDisabled = searchPage === 1;

    html += `<li class="page-item ${previousDisabled ? "disabled" : ""}">
        <button class="page-link" type="button" data-page="${searchPage - 1}"
            aria-label="Página anterior" ${previousDisabled ? "disabled" : ""}>
            <i class="bi bi-chevron-left" aria-hidden="true"></i>
        </button>
    </li>`;

    for (let page = firstPage; page <= lastPage; page++) {
        const isCurrent = page === searchPage;
        const currentAttribute = isCurrent ? 'aria-current="page"' : "";

        html += `<li class="page-item ${isCurrent ? "active" : ""}">
            <button class="page-link" type="button" data-page="${page}" ${currentAttribute}>
                ${page}
            </button>
        </li>`;
    }

    const nextDisabled = searchPage === totalPages;

    html += `<li class="page-item ${nextDisabled ? "disabled" : ""}">
        <button class="page-link" type="button" data-page="${searchPage + 1}"
            aria-label="Página siguiente" ${nextDisabled ? "disabled" : ""}>
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
    </li>`;

    elements.pagination.innerHTML = html;
    elements.paginationNav.classList.remove("d-none");
}

/** Dibuja en la tabla los resultados de la página actual. */
function renderSearchResults() {
    const totalResults = searchResults.length;

    if (totalResults === 0) {
        elements.searchResults.classList.add("d-none");
        elements.paginationNav.classList.add("d-none");
        return;
    }

    const totalPages = Math.ceil(totalResults / SEARCH_PAGE_SIZE);
    searchPage = Math.min(Math.max(searchPage, 1), totalPages);

    const start = (searchPage - 1) * SEARCH_PAGE_SIZE;
    const pageItems = searchResults.slice(start, start + SEARCH_PAGE_SIZE);

    elements.searchTbody.innerHTML = pageItems
        .map((verseIndex) => {
            const verse = verses[verseIndex];
            const reference = escapeHtml(formatReference(verse));
            const text = escapeHtml(verse.Text);

            return `<tr class="concordance-row" data-verse-index="${verseIndex}">
                <td class="text-nowrap"><span class="fw-semibold">${reference}</span></td>
                <td><span class="concordance-text" title="${text}">${text}</span></td>
            </tr>`;
        })
        .join("");

    const firstResult = start + 1;
    const lastResult = start + pageItems.length;
    elements.searchCount.textContent =
        `Mostrando ${firstResult}–${lastResult} de ${totalResults.toLocaleString("es-ES")} ` +
        `resultados para «${currentQuery}».`;

    hideSearchMessage();
    elements.searchResults.classList.remove("d-none");
    renderPagination(totalPages);
}

/** Busca el texto escrito dentro de todos los versículos de la Biblia. */
function handleSearch(event) {
    event.preventDefault();

    const query = elements.searchInput.value.trim();
    currentQuery = query;
    setActiveNav("concordancia");

    if (verses.length === 0) {
        showSearchMessage("La Biblia todavía se está cargando. Inténtalo en un momento.", "info");
        return;
    }

    if (query.length < MIN_SEARCH_LENGTH) {
        searchResults = [];
        searchPage = 1;
        showSearchMessage(
            `Escribe al menos ${MIN_SEARCH_LENGTH} caracteres para buscar en la concordancia.`,
            "warning"
        );
        return;
    }

    const normalizedQuery = normalizeText(query);
    const matches = [];

    for (let index = 0; index < verses.length; index++) {
        if (normalizeText(verses[index].Text).includes(normalizedQuery)) {
            matches.push(index);
        }
    }

    searchResults = matches;
    searchPage = 1;

    if (searchResults.length === 0) {
        showSearchMessage(`No se encontraron versículos que contengan «${query}».`, "warning");
        return;
    }

    renderSearchResults();
}

/** Muestra el versículo de un resultado y lleva al usuario a la tarjeta principal. */
function selectVerseByIndex(index) {
    const verse = verses[index];

    if (!verse) {
        return;
    }

    currentIndex = index;
    renderVerse(verse);
    setActiveNav("versiculo");
    closeMobileNav();
    scrollToSection("versiculo");
}

/** Detecta el clic sobre una fila de resultados. */
function handleResultClick(event) {
    const row = event.target.closest("tr[data-verse-index]");

    if (!row) {
        return;
    }

    selectVerseByIndex(Number(row.dataset.verseIndex));
}

/** Cambia de página en los resultados de la concordancia. */
function handlePaginationClick(event) {
    const button = event.target.closest("button[data-page]");

    if (!button || button.disabled) {
        return;
    }

    const totalPages = Math.ceil(searchResults.length / SEARCH_PAGE_SIZE);
    const page = Number(button.dataset.page);

    if (!Number.isInteger(page) || page < 1 || page > totalPages || page === searchPage) {
        return;
    }

    searchPage = page;
    renderSearchResults();
    elements.searchResults.scrollIntoView({ block: "start" });
}

// ============================================================================
// Compartir
// ============================================================================

/** Arma el texto que se comparte o se copia, con el versículo y su referencia. */
function buildShareText(verse) {
    return `«${verse.Text}»\n\n${formatReference(verse)} — Reina Valera 1960`;
}

/** Arma el mensaje completo: el texto del versículo y el enlace de la página. */
function buildShareMessage(verse) {
    return `${buildShareText(verse)}\n\n${window.location.href}`;
}

/** Construye destinos compatibles con redes sociales y aplicaciones de chat. */
function buildShareLinks(verse) {
    const text = buildShareText(verse);
    const message = buildShareMessage(verse);
    const pageUrl = window.location.href;
    const encodedMessage = encodeURIComponent(message);
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(pageUrl);

    return {
        whatsapp: `https://wa.me/?text=${encodedMessage}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
        email: `mailto:?subject=${encodeURIComponent(`${formatReference(verse)} — Reina Valera 1960`)}&body=${encodedMessage}`,
    };
}

/** Actualiza los destinos del menú para el versículo mostrado. */
function updateShareLinks(verse) {
    const links = buildShareLinks(verse);

    elements.shareWhatsApp.href = links.whatsapp;
    elements.shareTelegram.href = links.telegram;
    elements.shareFacebook.href = links.facebook;
    elements.shareX.href = links.x;
    elements.shareEmail.href = links.email;
}

/** Abre o oculta el menú de destinos disponible en equipos sin compartir nativo. */
function toggleShareMenu() {
    elements.shareButton.setAttribute("aria-expanded", "true");

    if (window.bootstrap?.Dropdown) {
        const dropdown = window.bootstrap.Dropdown.getOrCreateInstance(elements.shareButton, {
            target: "#share-menu",
            autoClose: true,
        });
        dropdown.toggle();
        return;
    }

    copyCurrentVerse();
}

/**
 * Copia texto al portapapeles.
 * Usa la API moderna cuando está disponible y, si no, un área de texto
 * temporal como respaldo para navegadores o contextos sin permisos.
 */
async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.className = "clipboard-helper";
    document.body.appendChild(helper);
    helper.select();

    const copied = document.execCommand("copy");
    document.body.removeChild(helper);

    if (!copied) {
        throw new Error("El navegador no permitió copiar el texto.");
    }
}

/** Copia el versículo actual con su enlace y muestra la confirmación. */
async function copyCurrentVerse() {
    if (!currentVerse) {
        return;
    }

    try {
        await copyText(buildShareMessage(currentVerse));
        showShareFeedback("Versículo y enlace copiados al portapapeles.", "success");
    } catch (error) {
        console.error("Error al copiar el versículo:", error);
        showShareFeedback("No se pudo compartir el versículo.", "error");
    }
}

/**
 * Acción principal del botón "Compartir".
 * Primero intenta el diálogo nativo del sistema (Web Share API), que en el
 * móvil permite elegir cualquier red social; si no está disponible o falla,
 * copia el texto al portapapeles.
 */
async function handleShare() {
    if (!currentVerse) {
        return;
    }

    const reference = formatReference(currentVerse);
    const text = buildShareText(currentVerse);
    const shareData = {
        title: `${reference} — Reina Valera 1960`,
        text,
    };

    // Solo se agrega la URL cuando la página se sirve por HTTP(S).
    if (window.location.protocol.startsWith("http")) {
        shareData.url = window.location.href;
    }

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            showShareFeedback("Versículo compartido.", "success");
            return;
        } catch (error) {
            // El usuario cerró el diálogo sin compartir: no hay nada que hacer.
            if (error.name === "AbortError") {
                return;
            }
            // Otro error: se intenta el respaldo de copiar al portapapeles.
        }
    }

    toggleShareMenu();
}

// ============================================================================
// Inicio de la aplicación
// ============================================================================

elements.button.addEventListener("click", handleRefresh);
elements.themeButton.addEventListener("click", cycleTheme);
elements.shareButton.addEventListener("click", handleShare);
elements.copyVerse.addEventListener("click", copyCurrentVerse);
elements.favoriteButton.addEventListener("click", toggleCurrentFavorite);
elements.chapterButton.addEventListener("click", toggleChapter);
elements.favoritesList.addEventListener("click", openFavorite);
elements.favoritesPagination.addEventListener("click", handleFavoritesPagination);
elements.chapterVerses.addEventListener("click", selectChapterVerse);
elements.chapterShrink.addEventListener("click", () => resizeChapterText(-0.15));
elements.chapterGrow.addEventListener("click", () => resizeChapterText(0.15));

elements.searchForm.addEventListener("submit", handleSearch);
elements.searchTbody.addEventListener("click", handleResultClick);
elements.pagination.addEventListener("click", handlePaginationClick);

document.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", () => {
        setActiveNav(link.dataset.nav);
        closeMobileNav();
    });
});

window.addEventListener("hashchange", syncNavFromHash);
syncNavFromHash();
loadTheme();

// Al cargar la página se obtiene la Biblia y se muestra el primer versículo.
loadBible();
