from pathlib import Path
import json
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parent
uri='http://127.0.0.1:17864/tests/ui-r6/office-layout-fixture.html'
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width in [390,768,1024,1440]:
  page=browser.new_page(viewport={'width':width,'height':880},device_scale_factor=1)
  page.goto(uri,wait_until='load')
  metrics=page.evaluate('''() => ({width:window.innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,tableCount:document.querySelectorAll('.responsive-table').length,labels:document.querySelectorAll('[data-label]').length})''')
  metrics['pass']=metrics['scrollWidth']<=width and metrics['bodyWidth']<=width and metrics['labels']>0
  if width in [390,1440]:page.screenshot(path=str(root/f'office-preview-{width}px.png'),full_page=True)
  results.append(metrics)
  page.close()
 browser.close()
(root/'visual-results.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
if not all(r['pass'] for r in results):raise SystemExit(1)
