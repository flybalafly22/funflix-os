"""The Voice merge, end to end: the home session hands off to the real Trainer.

Assumes the Flask server is ALREADY running:
    python3 qa/voice_qa.py [base_url]     # default http://127.0.0.1:5099

Answers the five questions on the home page, checks the bar loads to 120 kg and that
nothing is stored before the explicit "Open your Trainer"; then checks /trainer
arrives greeted and pre-filled from sessionStorage (tab-scoped), and that
"Not you? Start blank" wipes it. Exit code 1 on any failure.
"""
import os, sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5099'
ok = True
def check(name, cond, detail=''):
    global ok
    ok = ok and bool(cond)
    print(('PASS ' if cond else 'FAIL ') + name + ('  ' + str(detail) if detail else ''))
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}, reduced_motion='reduce')
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.goto(BASE + '/', wait_until='networkidle')
    pg.evaluate("document.documentElement.style.scrollBehavior='auto'")
    pg.fill('#nameInput', 'Maya Patel')
    pg.evaluate("document.getElementById('nameGo').click()")
    pg.wait_for_timeout(400)
    for key, val in [('goal', 'muscle'), ('exp', 'returning'), ('kit', 'dumbbells'), ('days', '4'), ('why', 'people')]:
        pg.wait_for_function(f"!document.querySelector('#q-{key}').classList.contains('locked')", timeout=8000)
        pg.evaluate(f"document.querySelector('.chips[data-key=\"{key}\"] .chip[data-val=\"{val}\"]').click()")
        pg.wait_for_timeout(350)
    kg = pg.inner_text('#barWeightN')
    check('bar loaded to 120 kg', kg.strip() == '120', kg)
    split = pg.inner_text('#c-split')
    check('carry shows the engine split name', 'Upper / lower' in split, split)
    # nothing is stored until the explicit click
    pre = pg.evaluate("sessionStorage.getItem('trainerHandoff')")
    check('no handoff stored before Open', pre is None, pre)
    ls_keys = pg.evaluate("Object.keys(localStorage)")
    check('landing writes nothing to localStorage (only theme allowed)', all(k in ('trainerTheme',) for k in ls_keys), ls_keys)
    pg.evaluate("document.getElementById('openBtn').click()")
    pg.wait_for_url('**/trainer', timeout=8000)
    pg.wait_for_load_state('networkidle')
    pg.wait_for_timeout(500)
    ho = pg.evaluate("JSON.parse(sessionStorage.getItem('trainerHandoff'))")
    check('handoff rides in sessionStorage (tab-scoped)', ho and ho.get('name') == 'Maya Patel', ho)
    check('handoff strip visible', pg.is_visible('#handoff'))
    vals = pg.evaluate("""() => ({name: fName.value, goal: fGoal.value, exp: fExp.value, env: fEnv.value, days: fDays.value,
        extra: fExtra.value, title: modTitle.textContent, over: modOver.textContent, welcome: getComputedStyle(welcome).display,
        marked: [...document.querySelectorAll('.field.from-session')].length, chips: hoChips.textContent})""")
    check('name prefilled', vals['name'] == 'Maya Patel', vals['name'])
    check('goal mapped', vals['goal'] == 'Muscle gain', vals['goal'])
    check('experience mapped', vals['exp'].startswith('Beginner'), vals['exp'])
    check('equipment mapped', vals['env'] == 'Home: dumbbells', vals['env'])
    check('days mapped', vals['days'] == '4', vals['days'])
    check('why + returning note in extra info', 'Coming back after a break' in vals['extra'] and 'my people' in vals['extra'], vals['extra'])
    check('header greets by first name', 'Maya' in vals['title'] and 'Four facts' in vals['title'], vals['title'])
    check('welcome skipped', vals['welcome'] == 'none', vals['welcome'])
    check('fields marked from-session', vals['marked'] >= 5, vals['marked'])
    pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots', 'voice_handoff_1280.png'), full_page=True)
    # the rest of the intake + a (keyless demo) build consumes nothing but a REAL plan clears the handoff
    # "Not you? Start blank" clears everything the session filled
    pg.evaluate("document.getElementById('hoClear').click()")
    pg.wait_for_timeout(200)
    after = pg.evaluate("""() => ({ho: sessionStorage.getItem('trainerHandoff'), name: fName.value, strip: document.getElementById('handoff').hidden,
        title: modTitle.textContent, marked: document.querySelectorAll('.field.from-session').length, extra: fExtra.value})""")
    check('start blank clears storage + fields', after['ho'] is None and after['name'] == '' and after['strip'] and after['marked'] == 0 and after['extra'] == '', after)
    check('header returns to default', 'write your program' in after['title'], after['title'])
    check('no console errors', not errs, errs[:4])
    b.close()
print('ALL PASS' if ok else 'SOME FAILED')
sys.exit(0 if ok else 1)
