const selected = new URLSearchParams(location.search).get('lang');
let saved: string | null = null;
try {
  if (selected === 'en' || selected === 'de') localStorage.setItem('notenlernen-language', selected);
  saved = localStorage.getItem('notenlernen-language');
} catch { /* The explicit URL still selects the interface without browser storage. */ }

export const language = selected === 'en' || (selected !== 'de' && saved === 'en') ? 'en' : 'de';

export function t(german: string, english: string): string {
  return language === 'en' ? english : german;
}

document.documentElement.lang = language;
if (language === 'en') {
  for (const element of document.querySelectorAll<HTMLElement>('[data-en]')) {
    element.textContent = element.dataset.en!;
  }
  for (const element of document.querySelectorAll<HTMLElement>('[data-en-aria]')) {
    element.setAttribute('aria-label', element.dataset.enAria!);
  }
  document.querySelector('meta[name="description"]')?.setAttribute('content', 'Notenlernen, an offline app for reading notes and training intervals.');
}

export function languageLink(): void {
  const link = document.querySelector<HTMLAnchorElement>('#language-link')!;
  const next = language === 'de' ? 'en' : 'de';
  const url = new URL(location.href);
  url.searchParams.set('lang', next);
  link.href = url.href;
  link.textContent = next === 'en' ? 'English' : 'Deutsch';
  link.lang = next;
  link.hreflang = next;
  document.querySelector<HTMLAnchorElement>('#privacy-link')!.hash = language;
}
