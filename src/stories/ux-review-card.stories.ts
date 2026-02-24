import type { Meta, StoryObj } from '@storybook/angular';

type UxReviewCardArgs = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  highlighted: boolean;
};

const meta: Meta<UxReviewCardArgs> = {
  title: 'UX/UxReviewCard',
  tags: ['autodocs'],
  render: (args: UxReviewCardArgs) => ({
    props: args,
    template: `
      <article
        role="article"
        [attr.aria-label]="title"
        style="
          width: min(560px, 90vw);
          border-radius: 20px;
          padding: 24px;
          color: #161616;
          background:
            radial-gradient(circle at 20% 0%, #f4d7ad 0%, transparent 45%),
            linear-gradient(135deg, #fff8ea 0%, #f1eee8 100%);
          border: 1px solid #dfd5c5;
          box-shadow: 0 12px 34px rgba(43, 35, 24, 0.12);
        "
      >
        <p style="margin:0; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; color:#7a6546;">
          {{ eyebrow }}
        </p>
        <h2 style="margin:8px 0 10px; font-size:28px; line-height:1.1;">{{ title }}</h2>
        <p style="margin:0 0 18px; font-size:15px; line-height:1.5; color:#3e3a33;">
          {{ description }}
        </p>
        <button
          type="button"
          [style.background]="highlighted ? '#2e2a23' : '#86623c'"
          style="
            border: 0;
            border-radius: 999px;
            color: #fff;
            padding: 10px 16px;
            font-weight: 600;
            letter-spacing: 0.02em;
            cursor: pointer;
          "
        >
          {{ cta }}
        </button>
      </article>
    `
  }),
  args: {
    eyebrow: 'Design QA',
    title: 'Revisione UI intenzionale',
    description:
      'Usa Storybook per validare gerarchia visiva, contrasti e comportamento responsive prima di integrare in feature reali.',
    cta: 'Apri flusso',
    highlighted: true
  },
  argTypes: {
    highlighted: { control: 'boolean' }
  }
};

export default meta;
type Story = StoryObj<UxReviewCardArgs>;

export const Default: Story = {};

export const Neutral: Story = {
  args: {
    highlighted: false,
    eyebrow: 'A/B Variant',
    title: 'Versione neutra',
    cta: 'Valuta variante'
  }
};
