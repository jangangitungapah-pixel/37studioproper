import re
import os

files_to_process = [
    'src/pages/admin/CustomerPage.jsx',
    'src/pages/admin/BillingPage.jsx'
]

for filepath in files_to_process:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # CustomerPage refactor
    if 'CustomerPage.jsx' in filepath:
        # We find <button className="customer-row" ...> ... </button>
        # and replace with <details><summary>...</summary><div>...</div></details>
        # But wait, it's inside <article className="customer-row-wrapper"> in CustomerPage
        content = re.sub(
            r'<button([^>]*?className="customer-row"[^>]*?)>(.*?)</button>',
            r'<details className="bento-accordion customer-row"><summary className="bento-accordion-summary">\2<span className="accordion-hint">Ketuk untuk detail</span></summary><div className="bento-accordion-content"><button\1>Buka Profil Lengkap</button></div></details>',
            content,
            flags=re.DOTALL
        )
    
    # BillingPage refactor
    if 'BillingPage.jsx' in filepath:
        content = re.sub(
            r'<button([^>]*?className="billing-row-main"[^>]*?)>(.*?)</button>',
            r'<details className="bento-accordion billing-row-main"><summary className="bento-accordion-summary">\2<span className="accordion-hint">Detail Tagihan</span></summary><div className="bento-accordion-content"><button\1>Kelola Tagihan</button></div></details>',
            content,
            flags=re.DOTALL
        )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
print('Refactor applied.')
