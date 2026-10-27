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
    shareMenuButton: document.getElementById("share-menu-button"),
    shareFeedback: document.getElementById("share-feedback"),
    status: document.getElementById("verse-status"),
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

// Enlaces a redes sociales; se completan con el versículo actual.
const socialLinks = {
    whatsapp: document.getElementById("share-whatsapp"),
    facebook: document.getElementById("share-facebook"),
    x: document.getElementById("share-x"),
    telegram: document.getElementById("share-telegram"),
};

// Estado de la aplicación.
let verses = [];          // Lista completa de versículos cargados desde el JSON.
let currentIndex = -1;    // Posición del versículo actual dentro de `verses`.
let currentVerse = null;  // Objeto del versículo que se está mostrando.
let feedbackTimer = null; // Temporizador para ocultar el mensaje de compartir.
let searchResults = [];   // Índices de los versículos que coinciden con la búsqueda.
let searchPage = 1;       // Página actual de resultados (empieza en 1).
let currentQuery = "";    // Último texto buscado, para mostrarlo en el resumen.

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
        elements.shareMenuButton.disabled = true;
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

    if (["inicio", "versiculo", "concordancia"].includes(view)) {
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
    elements.shareMenuButton.disabled = false;

    clearShareFeedback();
    updateSocialLinks(verse);

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
    elements.shareMenuButton.disabled = true;

    elements.error.textContent = message;
    elements.error.classList.remove("d-none");
    elements.reference.textContent = "No disponible";
    elements.text.textContent = "No se pudo mostrar el versículo.";
    elements.title.textContent = "";
    elements.status.textContent = message;
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
                <td class="text-end">
                    <button type="button" class="btn btn-sm btn-outline-primary rounded-pill px-3"
                        data-verse-index="${verseIndex}">
                        Ver
                    </button>
                </td>
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

/**
 * Construye la URL de compartir para cada red social.
 * El texto y la dirección de la página se codifican para que viajen
 * correctamente dentro de la URL.
 */
function buildShareUrl(network, verse) {
    const text = buildShareText(verse);
    const pageUrl = window.location.href;
    const encodedText = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(pageUrl);

    const urls = {
        whatsapp: `https://wa.me/?text=${encodeURIComponent(buildShareMessage(verse))}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
        x: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
        telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`,
    };

    return urls[network] ?? "#";
}

/** Actualiza los enlaces del menú para que compartan el versículo actual. */
function updateSocialLinks(verse) {
    for (const [network, link] of Object.entries(socialLinks)) {
        link.href = buildShareUrl(network, verse);
    }
}

/** Abre una URL externa en una pestaña nueva sin perder la referencia de origen. */
function openExternalWindow(url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
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

    await copyCurrentVerse();
}

/**
 * Facebook no permite prerrellenar el texto de la publicación desde la web:
 * su enlace de compartir solo acepta la dirección. Por eso se abre su ventana
 * y se copia el texto completo para que el usuario solo tenga que pegarlo.
 */
async function handleFacebookShare(event) {
    event.preventDefault();

    if (!currentVerse) {
        return;
    }

    // Se abre Facebook dentro del gesto del usuario para evitar bloqueos.
    openExternalWindow(buildShareUrl("facebook", currentVerse));

    try {
        await copyText(buildShareMessage(currentVerse));
        showShareFeedback("Texto copiado. Pégalo en tu publicación de Facebook.", "success");
    } catch (error) {
        console.error("Error al copiar el texto para Facebook:", error);
        showShareFeedback("Usa «Copiar versículo y enlace» y pégalo en Facebook.", "error");
    }
}

// ============================================================================
// Inicio de la aplicación
// ============================================================================

elements.button.addEventListener("click", handleRefresh);
elements.shareButton.addEventListener("click", handleShare);
document.getElementById("copy-verse").addEventListener("click", copyCurrentVerse);
socialLinks.facebook.addEventListener("click", handleFacebookShare);

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

// Al cargar la página se obtiene la Biblia y se muestra el primer versículo.
loadBible();
