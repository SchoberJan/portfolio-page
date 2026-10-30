const INTERVAL_MS = 4000;
const ACTIVE_CLASS = "slideshow__slide--active";

/**
 * Blendet die Fotos der Slideshow nacheinander ein.
 * Über die Punkte lässt sich ein Foto wählen; danach stoppt der automatische Wechsel.
 */
export function initSlideshow() {
  const slideshow = document.querySelector("[data-slideshow]");
  if (!slideshow) return;

  const slides = [...slideshow.querySelectorAll(".slideshow__slide")];
  // Weichgezeichnete Kopie direkt vor jedem Foto; das CSS blendet sie mit dem Foto ein
  for (const slide of slides) {
    const backdrop = slide.cloneNode();
    backdrop.className = "slideshow__backdrop";
    backdrop.alt = "";
    slide.before(backdrop);
  }
  if (slides.length < 2) return;

  let current = 0;
  let timer;

  const show = (index) => {
    current = index;
    slides.forEach((slide, i) => slide.classList.toggle(ACTIVE_CLASS, i === index));
    dots.forEach((dot, i) => dot.setAttribute("aria-current", String(i === index)));
  };

  // Ein ungeladenes Foto würde als leere Fläche eingeblendet.
  const isLoaded = (slide) => slide.complete && slide.naturalWidth > 0;

  const dotList = document.createElement("div");
  dotList.className = "slideshow__dots";

  const dots = slides.map((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "slideshow__dot";
    dot.setAttribute("aria-label", `Foto ${index + 1} von ${slides.length} anzeigen`);
    dot.addEventListener("click", () => {
      clearInterval(timer);
      if (isLoaded(slides[index])) {
        show(index);
      } else {
        slides[index].addEventListener("load", () => show(index), { once: true });
      }
    });
    dotList.append(dot);
    return dot;
  });

  slideshow.append(dotList);
  show(0);

  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    timer = setInterval(() => {
      const next = (current + 1) % slides.length;
      if (isLoaded(slides[next])) show(next);
    }, INTERVAL_MS);
  }
}
