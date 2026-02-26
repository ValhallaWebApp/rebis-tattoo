import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MaterialModule } from '../../../../core/modules/material.module';

export type DynamicFieldType =
  | 'time'
  | 'color'
  | 'text'
  | 'email'
  | 'number'
  | 'password'
  | 'textarea'
  | 'select'
  | 'button-toggle'
  | 'checkbox'
  | 'toggle'
  | 'date'
  | 'date-native'
  | 'autocomplete';

export interface DynamicFieldOption {
  label: string;
  value: unknown;
}

export interface DynamicField {
  type: DynamicFieldType;
  name: string;
  label: string;
  placeholder?: string;
  hint?: string;
  className?: string;
  options?: DynamicFieldOption[];
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  value?: unknown;
  rows?: number;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp | string;
  validators?: ValidatorFn[];
}

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './dynamic-form.component.html',
  styleUrls: ['./dynamic-form.component.scss']
})
export class DynamicFormComponent implements OnInit, OnChanges, OnDestroy {
  @Input() fields: DynamicField[] = [];
  @Input() formGroupInput?: FormGroup;
  @Input() showSubmit = true;
  @Input() submitLabel = 'Salva';
  @Input() submitColor: 'primary' | 'accent' | 'warn' = 'primary';
  @Input() submitDisabled = false;

  @Output() formSubmit = new EventEmitter<Record<string, unknown>>();

  form: FormGroup = new FormGroup({});
  isExternalForm = false;
  filteredOptionsMap: Record<string, DynamicFieldOption[]> = {};

  private readonly subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.setupForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields'] || changes['formGroupInput']) {
      this.setupForm();
    }
  }

  ngOnDestroy(): void {
    this.clearSubscriptions();
  }

  displayWith = (fieldName: string) => (value: unknown): string => {
    const field = this.fields.find((f) => f.name === fieldName);
    const match = field?.options?.find((o) => o.value === value);
    if (match) return match.label;
    return typeof value === 'string' ? value : '';
  };

  trackByName = (_: number, field: DynamicField): string => field.name;

  isFieldInvalid(fieldName: string): boolean {
    const control = this.form.get(fieldName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getFieldError(field: DynamicField): string {
    const errors = this.form.get(field.name)?.errors;
    if (!errors) return '';
    if (errors['required']) return `${field.label} obbligatorio`;
    if (errors['email']) return 'Inserisci una email valida';
    if (errors['minlength']) return `Minimo ${errors['minlength'].requiredLength} caratteri`;
    if (errors['maxlength']) return `Massimo ${errors['maxlength'].requiredLength} caratteri`;
    if (errors['min']) return `Valore minimo ${errors['min'].min}`;
    if (errors['max']) return `Valore massimo ${errors['max'].max}`;
    if (errors['pattern']) return 'Formato non valido';
    return 'Valore non valido';
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.formSubmit.emit(this.form.getRawValue() as Record<string, unknown>);
      return;
    }
    this.form.markAllAsTouched();
  }

  private setupForm(): void {
    this.clearSubscriptions();

    this.isExternalForm = !!this.formGroupInput;
    this.form = this.formGroupInput ?? this.buildInternalForm();

    if (this.isExternalForm) {
      this.ensureExternalControls();
    }

    this.bindAutocompleteFilters();
  }

  private buildInternalForm(): FormGroup {
    const group: Record<string, FormControl> = {};
    for (const field of this.fields) {
      const control = new FormControl(
        { value: this.getInitialValue(field), disabled: !!field.disabled },
        this.buildValidators(field)
      );
      group[field.name] = control;
    }
    return new FormGroup(group);
  }

  private ensureExternalControls(): void {
    for (const field of this.fields) {
      const existing = this.form.get(field.name);
      if (!existing) {
        this.form.addControl(
          field.name,
          new FormControl(
            { value: this.getInitialValue(field), disabled: !!field.disabled },
            this.buildValidators(field)
          )
        );
        continue;
      }

      if (field.disabled && existing.enabled) {
        existing.disable({ emitEvent: false });
      } else if (!field.disabled && existing.disabled) {
        existing.enable({ emitEvent: false });
      }
    }
  }

  private bindAutocompleteFilters(): void {
    this.filteredOptionsMap = {};

    for (const field of this.fields) {
      if (field.type !== 'autocomplete') continue;

      const options = field.options ?? [];
      this.filteredOptionsMap[field.name] = options;

      const control = this.form.get(field.name);
      if (!control) continue;

      const sub = control.valueChanges.subscribe((raw) => {
        const input = typeof raw === 'string' ? raw.toLowerCase() : '';
        this.filteredOptionsMap[field.name] = options.filter((opt) =>
          opt.label.toLowerCase().includes(input)
        );
      });
      this.subscriptions.push(sub);
    }
  }

  private clearSubscriptions(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
    this.subscriptions.length = 0;
  }

  private buildValidators(field: DynamicField): ValidatorFn[] {
    const validators: ValidatorFn[] = [];
    if (field.required) validators.push(Validators.required);
    if (field.type === 'email') validators.push(Validators.email);
    if (typeof field.min === 'number') validators.push(Validators.min(field.min));
    if (typeof field.max === 'number') validators.push(Validators.max(field.max));
    if (typeof field.minLength === 'number') validators.push(Validators.minLength(field.minLength));
    if (typeof field.maxLength === 'number') validators.push(Validators.maxLength(field.maxLength));
    if (field.pattern) validators.push(Validators.pattern(field.pattern));
    if (field.validators?.length) validators.push(...field.validators);
    return validators;
  }

  private getInitialValue(field: DynamicField): unknown {
    if (field.value !== undefined) return field.value;
    if (field.type === 'checkbox' || field.type === 'toggle') return false;
    if (field.type === 'date-native') return '';
    if (field.type === 'date') return null;
    return '';
  }
}
