import { Accordion } from '@base-ui/react/accordion';
import { ChevronDown, HelpCircle } from 'lucide-react';

export default function LandingFaqSection({ items = [] }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <section
      id="faq"
      tabIndex={-1}
      className="client-landing-faq"
      aria-labelledby="faq-heading"
    >
      <div className="client-landing-faq-layout">
        <div className="client-landing-faq-intro">
          <span className="client-landing-kicker">
            <HelpCircle size={14} aria-hidden="true" />
            Informasi & Kebijakan
          </span>
          <h2 id="faq-heading">Pertanyaan yang sering ditanyakan sebelum booking.</h2>
          <p>
            Dirangkum langsung dari jam operasional, kalkulasi tarif aktif, serta kebijakan pembayaran studio.
          </p>
        </div>

        <Accordion.Root
          className="client-landing-faq-list"
          defaultValue={[items[0].id]}
          multiple={false}
        >
          {items.map((item) => (
            <Accordion.Item
              key={item.id}
              value={item.id}
              className="client-landing-faq-item"
            >
              <Accordion.Header className="client-landing-faq-header">
                <Accordion.Trigger className="client-landing-faq-trigger">
                  <span>{item.question}</span>
                  <ChevronDown
                    size={18}
                    className="client-landing-faq-chevron"
                    aria-hidden="true"
                  />
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Panel className="client-landing-faq-panel">
                <div className="client-landing-faq-answer">
                  <p>{item.answer}</p>
                </div>
              </Accordion.Panel>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
