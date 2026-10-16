// Server Action → revalidatePath() заставляет Next.js подтянуть свежие RSC-данные
// и перерисовать страницу; иногда этот пересчёт прилетает не за 1-2 кадра,
// а позже (задержка сети до сервера), и одноразовое scrollTo() после await
// не успевает — браузер снова сбрасывает скролл к 0 уже после нашего
// восстановления. Поэтому держим позицию силой в течение окна времени
// после клика, а не одним отложенным вызовом.
export function holdScrollPosition(durationMs = 800) {
  const scrollY = window.scrollY;
  const start = performance.now();

  function tick() {
    if (window.scrollY !== scrollY) {
      window.scrollTo(0, scrollY);
    }
    if (performance.now() - start < durationMs) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}
