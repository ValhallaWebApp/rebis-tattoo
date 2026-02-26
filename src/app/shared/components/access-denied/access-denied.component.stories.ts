import { provideRouter } from '@angular/router';
import { applicationConfig, Meta, StoryObj } from '@storybook/angular';
import { AccessDeniedComponent } from './access-denied.component';

const meta: Meta<AccessDeniedComponent> = {
  title: 'Shared/AccessDenied',
  component: AccessDeniedComponent,
  tags: ['autodocs'],
  decorators: [
    applicationConfig({
      providers: [provideRouter([])]
    })
  ]
};

export default meta;
type Story = StoryObj<AccessDeniedComponent>;

export const Default: Story = {};

export const InPanel: Story = {
  render: () => ({
    template: `
      <div style="max-width: 720px; margin: 2rem auto; border: 1px solid #e5e7eb; border-radius: 12px;">
        <app-access-denied></app-access-denied>
      </div>
    `
  })
};
