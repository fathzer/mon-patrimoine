import { I18n } from '../core/I18n.js';
import { HelpPopover } from './HelpPopover.js';

/**
 * Content of the inline banner displayed next to figures shown in constant
 * (inflation-adjusted) euros — summary totals, category breakdown and asset
 * table — so the adjustment can not be mistaken for nominal amounts. The `?`
 * popover explains where the inflation source is selected. Callers wrap this
 * content in the container suiting their spot (`.inflation-banner` strip on
 * top of a card, a table row cell). `baseMonth` is the latest published
 * month of the active INSEE series.
 */
export function getInflationDisplayBanner(baseMonth: string): string {
  const help = HelpPopover.getHtml({
    title: I18n.t('inflation.bannerHelpTitle'),
    content: `<p>${I18n.t('inflation.bannerHelpBody', { month: baseMonth })}</p><p>${I18n.t('inflation.bannerHelpWhere', { inflationMenu: I18n.t('history.inflationLabel'), historyCard: I18n.t('history.title') })}</p>`,
    label: '?',
    icon: true
  });
  return `⚠️ <span>${I18n.t('inflation.banner', { month: baseMonth })}</span>${help}`;
}
