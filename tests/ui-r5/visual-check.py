"""QA de CSS em fixture isolada: nao testa telas autenticadas ou backend."""
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[2]
html = (root / 'tests/ui-r5/layout-fixture.html').read_text(encoding='utf8')
css = (root / 'apps/web/src/styles.css').read_text(encoding='utf8')
html = html.replace('<link rel="stylesheet" href="../../apps/web/src/styles.css"/>', '<style>' + css + '</style>')
logo = base64.b64encode((root / 'apps/web/public/brand/ds-logo.webp').read_bytes()).decode('ascii')
html = html.replace('../../apps/web/public/brand/ds-logo.webp', 'data:image/webp;base64,' + logo)
out = root / 'docs/ui-modernizacao/qa'
out.mkdir(parents=True, exist_ok=True)
checks = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox', '--disable-dev-shm-usage'])
    for w in (390, 768, 1024, 1440):
        page = browser.new_page(viewport={'width':w, 'height':860}, device_scale_factor=1)
        page.set_content(html, wait_until='load')
        page.screenshot(path=str(out / f'layout-estatico-{w}px.png'), full_page=True)
        data = page.evaluate('''() => ({width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
          mobileMenu:getComputedStyle(document.querySelector('.mobile-menu')).display,
          cards:getComputedStyle(document.querySelector('.responsive-table tbody tr')).display,
          calendarScroll:document.querySelector('.calendar-scroll').scrollWidth > document.querySelector('.calendar-scroll').clientWidth})''')
        data['ok_horizontal_page'] = data['scrollWidth'] <= data['width'] + 1
        data['ok_cards_mobile'] = data['cards'] == 'grid' if w <= 740 else True
        checks.append(data)
        page.close()
    browser.close()
(out / 'layout-estatico-resultados.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
for c in checks: print(c)
assert all(c['ok_horizontal_page'] for c in checks), 'Vazamento horizontal no layout estático'
assert all(c['ok_cards_mobile'] for c in checks), 'Cards de tabela não se reorganizaram no mobile'
