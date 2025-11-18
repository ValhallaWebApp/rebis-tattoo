import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MaterialModule } from '../../../../core/modules/material.module';

export interface DynamicField {
  type: 'time' | 'text' | 'email' | 'number' | 'password' | 'textarea' | 'select' | 'checkbox' | 'date' | 'autocomplete'; // ⬅️ aggiunto
  name: string;
  label: string;
  placeholder: string;
  options?: { label: string; value: any }[];
  required?: boolean;
  disabled?: boolean;
  value?: any;

}

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './dynamic-form.component.html',
  styleUrls: ['./dynamic-form.component.scss']
})
export class DynamicFormComponent implements OnInit {
  @Input() fields: DynamicField[] = [];
  @Output() formSubmit = new EventEmitter<any>();
  autoMap: Record<string, any> = {};
  filteredOptionsMap: Record<string, { label: string; value: any }[]> = {};

  autocompleteRefs: Record<string, any> = {};


  form!: FormGroup;

  ngOnInit(): void {
    this.buildForm();
    this.prepareAutocompleteRefs();
  }
  prepareAutocompleteRefs(): void {
    for (const field of this.fields) {
      if (field.type === 'autocomplete') {
        const uniqueId = `${field.name}Auto`;
        this.autoMap[field.name] = uniqueId;
      }
    }
  }

  displayWith = (fieldName: string) => (value: any): string => {
    const field = this.fields.find(f => f.name === fieldName);
    const match = field?.options?.find(o => o.value === value);
    return match ? match.label : value;
  };

  buildForm(): void {
    const group: any = {};
    this.fields.forEach(field => {
      const control = new FormControl(
        field.value || '',
        field.required ? Validators.required : []
      );
      group[field.name] = control;

      if (field.type === 'autocomplete') {
        this.filteredOptionsMap[field.name] = field.options || [];

        console.log(field.options)
        control.valueChanges.subscribe(input => {
          const filterValue = typeof input === 'string' ? input.toLowerCase() : '';
          this.filteredOptionsMap[field.name] = (field.options || []).filter(opt =>
            opt.label.toLowerCase().includes(filterValue)
          );
        });
      }
    });

    this.form = new FormGroup(group);
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.formSubmit.emit(this.form.value); // ✅ trasmette il valore
      console.log('submit form',this.form.value)
    } else {
      this.form.markAllAsTouched();
    }
  }

}
