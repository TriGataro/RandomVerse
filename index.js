// ============================================================================
// Configuración y referencias del DOM
// ============================================================================

// Ruta del archivo que contiene todos los versículos de la Biblia.
const DATA_URL = "Biblia.json";

// Tiempo (en milisegundos) que permanece visible el mensaje de compartir.
const FEEDBACK_DURATION = 3000;

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

/**
 * Activa o desactiva el estado de carga de los botones de acción.
 * Mientras se carga la Biblia, actualizar y compartir quedan bloqueados.
 */
function setLoading(isLoading) {
    elements.button.disabled = isLoading;

    if (isLoading) {
        elements.shareButton.disabled = true;
        elements.shareMenuButton.disabled = true;
    }

    // El icono se convierte en un spinner mientras se obtienen los datos.
    elements.icon.className = isLoading
        ? "spinner-border spinner-border-sm me-2"
        : "bi bi-arrow-clockwise me-2";
    elements.label.textContent = isLoading
        ? "Cargando…"
        : "Actualizar versículo";
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
// Compartir
// ============================================================================

/** Arma el texto que se comparte o se copia, con el versículo y su referencia. */
function buildShareText(verse) {
    return `«${verse.Text}»\n\n${formatReference(verse)} — Reina Valera 1960`;
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
        whatsapp: `https://wa.me/?text=${encodeURIComponent(`${text}\n\n${pageUrl}`)}`,
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

/** Copia el versículo actual y muestra la confirmación correspondiente. */
async function copyCurrentVerse() {
    if (!currentVerse) {
        return;
    }

    try {
        await copyText(buildShareText(currentVerse));
        showShareFeedback("Versículo copiado al portapapeles.", "success");
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

// ============================================================================
// Inicio de la aplicación
// ============================================================================

elements.button.addEventListener("click", handleRefresh);
elements.shareButton.addEventListener("click", handleShare);
document.getElementById("copy-verse").addEventListener("click", copyCurrentVerse);

// Al cargar la página se obtiene la Biblia y se muestra el primer versículo.
loadBible();
