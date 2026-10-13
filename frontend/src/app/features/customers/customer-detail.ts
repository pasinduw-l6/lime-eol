import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInput } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import {
  AGREEMENT_TYPES,
  SCOPES,
  STATUS_INFO,
  SUPPORT_LEVELS,
  TERMS_INFO,
  TYPE_COLOURS,
  applicationText,
  daysUntil,
  infraText,
  termNote,
  termsFor,
  typeHint,
  typeLabel,
} from '../../core/agreements';
import {
  AgreementStatus,
  AgreementType,
  Api,
  ApiAgreement,
  ApiContact,
  ApiCustomerDetail,
  ApiProject,
} from '../../core/api';
import { Feedback } from '../../core/feedback';
import { RegistryStore } from '../../core/registry.store';
import { SessionStore } from '../../core/session';
import { TechIcon } from '../../shared/tech-icon';
import { Modal } from '../../shared/modal';

type Tab = 'agreement' | 'projects' | 'contacts';

interface AgreementForm {
  id?: string;
  type: AgreementType;
  startDate: string;
  endDate: string;
  renewalDate: string;
  noticeDays: number | null;
  autoRenew: boolean;
  upgradesPerYear: number | null;
  supportLevel: string;
  reference: string;
  documentUrl: string;
  infrastructure: 'INCLUDED' | 'QUOTED';
  licensedUsers: number | null;
  notes: string;
}

interface ContactForm {
  id?: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  isPrimary: boolean;
}

@Component({
  selector: 'lime-customer-detail',
  imports: [FormsModule, HlmBadgeImports, HlmButton, HlmCardImports, HlmInput, HlmLabel, Modal, RouterLink, TechIcon],
  host: { class: 'block' },
  template: `
    <a routerLink="/customers" class="mb-3 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">‹ Customers</a>

    @if (customer(); as c) {
      <header class="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="m-0 flex flex-wrap items-center gap-3 text-3xl font-semibold tracking-tight">
            {{ c.name }}
            <span class="tabular rounded-md border px-2 py-0.5 text-sm font-normal text-muted-foreground">{{ c.code || 'no code' }}</span>
            @let status = c.agreementStatus ?? 'NONE';
            <span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-normal" [style.color]="statusColour(status)" [style.border-color]="tint(statusColour(status), 40)">
              <span class="size-2 rounded-full" [style.background]="statusColour(status)"></span>
              {{ statusLabel(status) }}
            </span>
          </h1>
          <p class="m-0 mt-1 text-sm text-muted-foreground">
            {{ projects().length }} project{{ projects().length === 1 ? '' : 's' }} ·
            {{ c.contacts.length }} contact{{ c.contacts.length === 1 ? '' : 's' }}
            @if (c.notes) {
              · {{ c.notes }}
            }
          </p>
        </div>
        @if (canWrite()) {
          <div class="flex gap-2">
            <button type="button" hlmBtn variant="outline" (click)="editDetails(c)">Edit details</button>
            <button type="button" hlmBtn variant="ghost" class="text-destructive" (click)="archive(c)">Archive</button>
          </div>
        }
      </header>

      <div class="segmented mb-5" role="tablist" aria-label="Customer sections">
        @for (t of tabs; track t.key) {
          <button
            type="button"
            role="tab"
            class="px-4 py-1.5 text-[13px]"
            [attr.aria-selected]="tab() === t.key"
            [class.bg-background]="tab() === t.key"
            [class.shadow-sm]="tab() === t.key"
            [class.text-foreground]="tab() === t.key"
            [class.text-ink-soft]="tab() !== t.key"
            (click)="tab.set(t.key)"
          >
            {{ t.label }}
            <span class="ml-1 text-muted-foreground tabular">{{ t.key === 'agreement' ? c.agreements.length : t.key === 'projects' ? projects().length : c.contacts.length }}</span>
          </button>
        }
      </div>

      @switch (tab()) {
        @case ('agreement') {
          @if (current(); as a) {
            <section hlmCard class="mb-5 gap-0 p-0">
              <div class="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-5">
                <div>
                  <p class="m-0 text-[12px] tracking-wide text-muted-foreground uppercase">Current agreement</p>
                  <h2 class="m-0 mt-1 flex items-center gap-2 text-2xl font-semibold">
                    <span class="size-3 rounded-full" [style.background]="typeColour(a.type)"></span>
                    {{ typeLabel(a.type) }}
                  </h2>
                  <p class="m-0 mt-1 max-w-[560px] text-[13px] text-muted-foreground">{{ typeHint(a.type) }}</p>
                </div>
                @if (canWrite()) {
                  <div class="flex flex-wrap gap-2">
                    <button type="button" hlmBtn variant="outline" size="sm" (click)="editAgreement(a)">Edit</button>
                    <button type="button" hlmBtn variant="outline" size="sm" (click)="renew(a)">Renew</button>
                    <button type="button" hlmBtn size="sm" (click)="newAgreement()">New agreement</button>
                  </div>
                }
              </div>

              <div class="grid gap-0 lg:grid-cols-[1.1fr_1fr]">
                <div class="border-b px-6 py-5 lg:border-r lg:border-b-0">
                  <div class="mb-1 flex justify-between text-[13px]">
                    <span>{{ date(a.startDate) }}</span>
                    <span>{{ date(a.endDate) }}</span>
                  </div>
                  <div class="h-2 overflow-hidden rounded-full bg-muted">
                    <div class="h-full rounded-full" [style.width.%]="elapsed(a)" [style.background]="statusColour(a.status)"></div>
                  </div>
                  <p class="m-0 mt-1.5 text-[12.5px]" [style.color]="a.status === 'EXPIRED' ? 'var(--color-overdue)' : a.status === 'EXPIRING' ? 'var(--color-soon)' : 'var(--muted-foreground)'">
                    {{ termNote(a.endDate) }}
                  </p>

                  <dl class="m-0 mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-[13px] sm:grid-cols-3">
                    <div>
                      <dt class="text-muted-foreground">Renewal date</dt>
                      <dd class="m-0 mt-0.5 font-medium">{{ date(a.renewalDate || a.endDate) }}</dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">Notice period</dt>
                      <dd class="m-0 mt-0.5 font-medium">
                        {{ a.noticeDays !== null ? a.noticeDays + ' days' : '—' }}
                        @if (noticeBy(a); as by) {
                          <span class="block text-[12px] font-normal" [style.color]="(daysUntil(by) ?? 1) < 0 ? 'var(--color-overdue)' : 'var(--muted-foreground)'">give notice by {{ date(by) }}</span>
                        }
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">Auto-renew</dt>
                      <dd class="m-0 mt-0.5 font-medium">{{ a.autoRenew ? 'Yes' : 'No' }}</dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">Upgrades included</dt>
                      <dd class="m-0 mt-0.5 font-medium">
                        @if (a.type === 'LICENSE') {
                          None, quoted
                        } @else {
                          {{ a.upgradesPerYear !== null ? a.upgradesPerYear + ' per year' : 'Unlimited' }}
                        }
                      </dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">Support level</dt>
                      <dd class="m-0 mt-0.5 font-medium">{{ a.supportLevel || '—' }}</dd>
                    </div>
                    <div>
                      <dt class="text-muted-foreground">Reference</dt>
                      <dd class="m-0 mt-0.5 font-medium">
                        {{ a.reference || '—' }}
                        @if (a.documentUrl) {
                          <a class="block text-[12px] font-normal hover:underline" style="color: var(--primary)" [href]="a.documentUrl" target="_blank" rel="noopener">Open contract ↗</a>
                        }
                      </dd>
                    </div>
                  </dl>
                  @if (a.notes) {
                    <p class="m-0 mt-5 rounded-lg bg-muted px-3 py-2 text-[13px]">{{ a.notes }}</p>
                  }
                </div>

                <div class="px-6 py-5">
                  <h3 class="m-0 mb-3 text-[13px] font-semibold">How upgrades are handled</h3>
                  <ul class="m-0 grid list-none gap-3 p-0 text-[13px]">
                    @for (s of scopes; track s.key) {
                      @let t = terms(s.key, a.coverage);
                      <li class="rounded-lg border p-3">
                        <span class="flex items-center justify-between gap-3">
                          <span class="font-medium">{{ s.label }}</span>
                          <span class="rounded-full border px-2 py-0.5 text-[11.5px]" [style.color]="termsInfo[t].colour" [style.border-color]="tint(termsInfo[t].colour, 40)">{{ termsInfo[t].label }}</span>
                        </span>
                        <span class="mt-1 block">{{ s.key === 'INFRASTRUCTURE' ? infraText(a.coverage) : applicationText(a.coverage) }}</span>
                        <span class="mt-0.5 block text-[11.5px] text-muted-foreground">{{ s.examples }}</span>
                      </li>
                    }
                  </ul>
                  @if (a.type === 'LICENSE' && a.licensedUsers) {
                    <p class="m-0 mt-3 text-[13px]">Licensed for <strong>{{ a.licensedUsers }}</strong> users</p>
                  }
                </div>
              </div>
            </section>
          } @else {
            <section hlmCard class="mb-5 px-6 py-8">
              <h2 class="m-0 text-lg font-semibold">No agreement recorded</h2>
              <p class="m-0 mt-1 text-[13px] text-muted-foreground">Until one is added, every upgrade for {{ c.name }} is treated as quoted.</p>
              @if (canWrite()) {
                <div class="mt-5 grid gap-3 md:grid-cols-3">
                  @for (t of types; track t.key) {
                    <button type="button" class="rounded-xl border p-4 text-left transition-colors hover:bg-muted/60" (click)="newAgreement(t.key)">
                      <span class="flex items-center gap-2 font-medium">
                        <span class="size-2.5 rounded-full" [style.background]="typeColour(t.key)"></span>{{ t.label }}
                      </span>
                      <span class="mt-1 block text-[12.5px] text-muted-foreground">{{ t.hint }}</span>
                    </button>
                  }
                </div>
              }
            </section>
          }

          @if (c.agreements.length > 0) {
            <section hlmCard class="gap-0 p-0">
              <h3 class="m-0 border-b px-6 py-3 text-[13px] font-semibold">History</h3>
              <ul class="m-0 list-none p-0">
                @for (a of c.agreements; track a.id) {
                  <li class="flex flex-wrap items-center gap-x-5 gap-y-1 border-b px-6 py-3 text-[13px] last:border-b-0">
                    <span class="flex w-[230px] items-center gap-2 font-medium">
                      <span class="size-2 rounded-full" [style.background]="typeColour(a.type)"></span>
                      {{ typeLabel(a.type) }}
                      @if (a.id === c.currentAgreementId) {
                        <span hlmBadge variant="secondary" class="text-[10.5px]">current</span>
                      }
                    </span>
                    <span class="w-[230px] tabular">{{ date(a.startDate) }} – {{ date(a.endDate) }}</span>
                    <span class="w-[110px]" [style.color]="statusColour(a.status)">{{ statusLabel(a.status) }}</span>
                    <span class="flex-1 text-muted-foreground">{{ a.reference || '' }}</span>
                    @if (canWrite()) {
                      <span class="flex gap-1">
                        <button type="button" hlmBtn variant="ghost" size="sm" (click)="editAgreement(a)">Edit</button>
                        <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="deleteAgreement(a)">Delete</button>
                      </span>
                    }
                  </li>
                }
              </ul>
            </section>
          }
        }

        @case ('projects') {
          <div class="grid gap-4">
            @for (p of projects(); track p.id) {
              <section hlmCard class="gap-0 p-0">
                <header class="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-4">
                  <div>
                    <h3 class="m-0 text-base font-semibold">{{ p.name }} <span class="tabular font-normal text-muted-foreground">· {{ p.code }}</span></h3>
                    <p class="m-0 mt-0.5 text-[12.5px] text-muted-foreground">
                      Lime {{ p.limeVersion || '—' }} · {{ p.status.toLowerCase() }} · {{ p.environments.length }} environment{{ p.environments.length === 1 ? '' : 's' }}
                      @if (p.risk.eol > 0) {
                        · <span class="text-destructive">{{ p.risk.eol }} past end of life</span>
                      }
                    </p>
                  </div>
                  <button type="button" hlmBtn variant="outline" size="sm" (click)="openProject(p)">Open overview</button>
                </header>
                <div class="overflow-x-auto">
                  <table class="w-full border-collapse text-[13px]">
                    <thead>
                      <tr class="text-muted-foreground">
                        <th class="px-6 py-2 text-left font-normal">Component</th>
                        @for (env of p.environments; track env.id) {
                          <th class="px-3 py-2 text-left font-normal">{{ env.environment }}</th>
                        }
                        <th class="px-6 py-2 text-left font-normal">Upgrades</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of componentRows(p); track row.technology) {
                        @let t = terms(row.scope, current()?.coverage);
                        <tr class="border-t">
                          <td class="px-6 py-2">
                            <span class="flex items-center gap-2">
                              <lime-tech-icon [technology]="row.technology" [size]="16" />
                              {{ row.technology }}
                              <span class="text-[11.5px] text-muted-foreground">{{ row.scope === 'INFRASTRUCTURE' ? 'Infrastructure' : 'Application' }}</span>
                            </span>
                          </td>
                          @for (env of p.environments; track env.id) {
                            @let comp = row.byEnv[env.environment];
                            <td class="px-3 py-2">
                              @if (comp) {
                                <span class="tabular">{{ comp.version }}</span>
                              } @else {
                                <span class="text-muted-foreground">—</span>
                              }
                            </td>
                          }
                          <td class="px-6 py-2">
                            <span class="rounded-full border px-2 py-0.5 text-[11.5px]" [title]="termsInfo[t].long" [style.color]="termsInfo[t].colour" [style.border-color]="tint(termsInfo[t].colour, 40)">{{ termsInfo[t].label }}</span>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </section>
            } @empty {
              <p hlmCard class="block px-6 py-10 text-center text-muted-foreground">No projects for {{ c.name }} yet.</p>
            }
          </div>
        }

        @case ('contacts') {
          <section hlmCard class="gap-0 p-0">
            <header class="flex items-center justify-between border-b px-6 py-3">
              <h3 class="m-0 text-[13px] font-semibold">Contacts</h3>
              @if (canWrite()) {
                <button type="button" hlmBtn size="sm" (click)="newContact()">+ Add contact</button>
              }
            </header>
            <ul class="m-0 list-none p-0">
              @for (person of c.contacts; track person.id) {
                <li class="flex flex-wrap items-center gap-x-5 gap-y-1 border-b px-6 py-3 text-[13px] last:border-b-0">
                  <span class="grid size-8 place-items-center rounded-full bg-muted text-[12px] font-semibold">{{ initials(person.name) }}</span>
                  <span class="min-w-[200px] flex-1">
                    <span class="flex items-center gap-2 font-medium">
                      {{ person.name }}
                      @if (person.isPrimary) {
                        <span hlmBadge class="text-[10.5px]">Primary · EOL notices</span>
                      }
                    </span>
                    <span class="block text-muted-foreground">{{ person.role || 'No role' }}</span>
                  </span>
                  <span class="w-[220px]">
                    @if (person.email) {
                      <a class="hover:underline" [href]="'mailto:' + person.email">{{ person.email }}</a>
                    }
                    @if (person.phone) {
                      <span class="block text-muted-foreground">{{ person.phone }}</span>
                    }
                  </span>
                  @if (canWrite()) {
                    <span class="flex gap-1">
                      @if (!person.isPrimary) {
                        <button type="button" hlmBtn variant="ghost" size="sm" (click)="makePrimary(person)">Make primary</button>
                      }
                      <button type="button" hlmBtn variant="ghost" size="sm" (click)="editContact(person)">Edit</button>
                      <button type="button" hlmBtn variant="ghost" size="sm" class="text-destructive" (click)="deleteContact(person)">Remove</button>
                    </span>
                  }
                </li>
              } @empty {
                <li class="px-6 py-8 text-center text-muted-foreground">No contacts yet. The primary contact receives end-of-life notices.</li>
              }
            </ul>
          </section>
        }
      }
    } @else if (failed()) {
      <p hlmCard class="block px-6 py-10 text-center text-muted-foreground">That customer could not be found.</p>
    } @else {
      <p class="text-muted-foreground">Loading…</p>
    }

    @if (agreementForm(); as f) {
      <lime-modal
        [title]="f.id ? 'Edit agreement' : 'New agreement'"
        [subtitle]="customer()?.name ?? ''"
        (dismiss)="agreementForm.set(null)"
      >
        <form class="grid gap-5" (submit)="saveAgreement($event)">
          <div class="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Agreement type">
            @for (t of types; track t.key) {
              <button
                type="button"
                role="radio"
                class="rounded-xl border p-3 text-left transition-colors"
                [attr.aria-checked]="f.type === t.key"
                [style.border-color]="f.type === t.key ? typeColour(t.key) : null"
                [style.background]="f.type === t.key ? tint(typeColour(t.key), 8) : null"
                (click)="setType(f, t.key)"
              >
                <span class="flex items-center gap-2 text-[13px] font-medium">
                  <span class="size-2.5 rounded-full" [style.background]="typeColour(t.key)"></span>{{ t.label }}
                </span>
                <span class="mt-1 block text-[11.5px] leading-snug text-muted-foreground">{{ t.hint }}</span>
              </button>
            }
          </div>

          @if (f.type === 'LICENSE') {
            <fieldset class="m-0 grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
              <legend class="px-1 text-[13px] font-medium">License terms</legend>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Infrastructure upgrades
                <select hlmInput name="infra" [(ngModel)]="f.infrastructure">
                  <option value="QUOTED">Quoted separately</option>
                  <option value="INCLUDED">Included in this agreement</option>
                </select>
              </label>
              <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
                Licensed users
                <input hlmInput type="number" min="1" name="users" [(ngModel)]="f.licensedUsers" placeholder="50" />
              </label>
              <p class="m-0 text-[12px] text-muted-foreground sm:col-span-2">
                Application dependency upgrades (Node.js, AngularJS, MongoDB) are not automatically included for license
                customers. They are assessed separately under the commercial process.
              </p>
            </fieldset>
          } @else {
            <p class="m-0 rounded-lg bg-muted px-3 py-2 text-[12.5px]">
              Infrastructure setup and upgrades are included for the agreed period (five years by default).
              Application dependencies are handled through applicable Lime releases.
            </p>
          }

          <div class="grid gap-3 sm:grid-cols-3">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Start
              <input hlmInput type="date" name="start" [(ngModel)]="f.startDate" (ngModelChange)="suggestEnd(f)" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              End
              <input hlmInput type="date" name="end" [(ngModel)]="f.endDate" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Renewal date
              <input hlmInput type="date" name="renewal" [(ngModel)]="f.renewalDate" />
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-4">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Notice (days)
              <input hlmInput type="number" min="0" name="notice" [(ngModel)]="f.noticeDays" placeholder="90" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Upgrades / year
              <input hlmInput type="number" min="0" name="upgrades" [(ngModel)]="f.upgradesPerYear" [disabled]="f.type === 'LICENSE'" placeholder="Unlimited" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Support level
              <select hlmInput name="support" [(ngModel)]="f.supportLevel">
                <option value="">Not set</option>
                @for (s of supportLevels; track s) {
                  <option [value]="s">{{ s }}</option>
                }
              </select>
            </label>
            <label class="flex items-end gap-2 pb-2 text-[13px]">
              <input type="checkbox" name="auto" [(ngModel)]="f.autoRenew" />
              Auto-renews
            </label>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Contract / PO reference
              <input hlmInput name="reference" [(ngModel)]="f.reference" placeholder="PO-2026-114" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Contract document link
              <input hlmInput type="url" name="doc" [(ngModel)]="f.documentUrl" placeholder="https://…" />
            </label>
          </div>


          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Notes
            <textarea hlmInput rows="2" class="h-auto py-2" name="notes" [(ngModel)]="f.notes"></textarea>
          </label>

          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="agreementForm.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ busy() ? 'Saving…' : f.id ? 'Save agreement' : 'Add agreement' }}</button>
          </div>
        </form>
      </lime-modal>
    }

    @if (contactForm(); as f) {
      <lime-modal [title]="f.id ? 'Edit contact' : 'Add contact'" [subtitle]="customer()?.name ?? ''" (dismiss)="contactForm.set(null)">
        <form class="grid gap-4" (submit)="saveContact($event)">
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Name
              <input hlmInput name="name" [(ngModel)]="f.name" required />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Role
              <input hlmInput name="role" [(ngModel)]="f.role" placeholder="IT Manager" />
            </label>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Email
              <input hlmInput type="email" name="email" [(ngModel)]="f.email" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Phone
              <input hlmInput name="phone" [(ngModel)]="f.phone" />
            </label>
          </div>
          <label class="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="primary" [(ngModel)]="f.isPrimary" />
            Primary contact. Receives end-of-life notices and appears on the customer report.
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="contactForm.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">{{ f.id ? 'Save contact' : 'Add contact' }}</button>
          </div>
        </form>
      </lime-modal>
    }

    @if (detailsForm(); as f) {
      <lime-modal title="Edit customer" [subtitle]="customer()?.name ?? ''" (dismiss)="detailsForm.set(null)">
        <form class="grid gap-4" (submit)="saveDetails($event)">
          <div class="grid gap-3 sm:grid-cols-[1fr_160px]">
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Name
              <input hlmInput name="name" [(ngModel)]="f.name" />
            </label>
            <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
              Code
              <input hlmInput class="tabular uppercase" name="code" [(ngModel)]="f.code" />
            </label>
          </div>
          <label hlmLabel class="flex-col items-stretch gap-1.5 *:font-normal">
            Notes
            <textarea hlmInput rows="3" class="h-auto py-2" name="notes" [(ngModel)]="f.notes"></textarea>
          </label>
          <div class="flex justify-end gap-2">
            <button type="button" hlmBtn variant="outline" (click)="detailsForm.set(null)">Cancel</button>
            <button type="submit" hlmBtn [disabled]="busy()">Save</button>
          </div>
        </form>
      </lime-modal>
    }
  `,
})
export class CustomerDetail {
  private readonly api = inject(Api);
  private readonly feedback = inject(Feedback);
  private readonly session = inject(SessionStore);
  private readonly store = inject(RegistryStore);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly types = AGREEMENT_TYPES;
  protected readonly scopes = SCOPES;
  protected readonly termsInfo = TERMS_INFO;
  protected readonly terms = termsFor;
  protected readonly infraText = infraText;
  protected readonly applicationText = applicationText;
  protected readonly typeHint = typeHint;
  protected readonly supportLevels = SUPPORT_LEVELS;
  protected readonly tabs: { key: Tab; label: string }[] = [
    { key: 'agreement', label: 'Agreement' },
    { key: 'projects', label: 'Projects' },
    { key: 'contacts', label: 'Contacts' },
  ];

  protected readonly typeLabel = typeLabel;
  protected readonly termNote = termNote;
  protected readonly daysUntil = daysUntil;

  protected readonly customer = signal<ApiCustomerDetail | null>(null);
  protected readonly failed = signal(false);
  protected readonly tab = signal<Tab>('agreement');
  protected readonly busy = signal(false);
  protected readonly agreementForm = signal<AgreementForm | null>(null);
  protected readonly contactForm = signal<ContactForm | null>(null);
  protected readonly detailsForm = signal<{ name: string; code: string; notes: string } | null>(null);

  protected readonly canWrite = computed(() => this.session.can('customer:write'));

  protected readonly current = computed(() => {
    const c = this.customer();
    return c?.agreements.find((a) => a.id === c.currentAgreementId) ?? null;
  });

  protected readonly projects = computed(() => this.api.projects().filter((p) => p.customerId === this.id()));

  constructor() {
    effect(() => this.load(this.id()));
  }

  private load(id: string): void {
    this.api.customer(id).subscribe({
      next: (c) => {
        this.customer.set(c);
        this.failed.set(false);
      },
      error: () => this.failed.set(true),
    });
  }

  private refresh(message?: string): void {
    this.busy.set(false);
    this.load(this.id());
    this.api.reload();
    if (message) this.feedback.success(message);
  }

  private readonly scopeOf = computed(
    () => new Map(this.api.technologies().map((t) => [t.name, t.scope as 'INFRASTRUCTURE' | 'APPLICATION'])),
  );

  protected componentRows(project: ApiProject) {
    type Row = { technology: string; scope: 'INFRASTRUCTURE' | 'APPLICATION'; byEnv: Partial<Record<string, { version: string }>> };
    const rows = new Map<string, Row>();
    for (const env of project.environments) {
      for (const comp of env.components) {
        const row = rows.get(comp.technology) ?? {
          technology: comp.technology,
          scope: this.scopeOf().get(comp.technology) ?? 'INFRASTRUCTURE',
          byEnv: {},
        };
        row.byEnv[env.environment] = { version: comp.version };
        rows.set(comp.technology, row);
      }
    }
    return [...rows.values()].sort(
      (a, b) => a.scope.localeCompare(b.scope) * -1 || a.technology.localeCompare(b.technology),
    );
  }

  protected statusLabel(status: AgreementStatus): string {
    return STATUS_INFO[status].label;
  }

  protected statusColour(status: AgreementStatus): string {
    return STATUS_INFO[status].colour;
  }

  protected typeColour(type: AgreementType): string {
    return TYPE_COLOURS[type];
  }

  protected tint(colour: string, percent: number): string {
    return `color-mix(in oklab, ${colour} ${percent}%, transparent)`;
  }

  protected date(value: string | null | undefined): string {
    if (!value) return '—';
    return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  protected elapsed(a: ApiAgreement): number {
    if (!a.startDate || !a.endDate) return a.status === 'EXPIRED' ? 100 : 0;
    const start = Date.parse(`${a.startDate}T00:00:00Z`);
    const end = Date.parse(`${a.endDate}T00:00:00Z`);
    return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100));
  }

  protected noticeBy(a: ApiAgreement): string | null {
    const end = a.renewalDate || a.endDate;
    if (!end || a.noticeDays === null) return null;
    return new Date(Date.parse(`${end}T00:00:00Z`) - a.noticeDays * 86_400_000).toISOString().slice(0, 10);
  }


  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join('');
  }

  protected openProject(project: ApiProject): void {
    this.store.scope.set(project.id);
    void this.router.navigateByUrl('/overview');
  }

  protected newAgreement(type: AgreementType = 'SUBSCRIPTION'): void {
    const today = new Date().toISOString().slice(0, 10);
    this.agreementForm.set({
      type,
      startDate: today,
      endDate: addYears(today, 5),
      renewalDate: '',
      noticeDays: 90,
      autoRenew: false,
      upgradesPerYear: null,
      supportLevel: 'Standard',
      reference: '',
      documentUrl: '',
      infrastructure: 'QUOTED',
      licensedUsers: null,
      notes: '',
    });
  }

  protected editAgreement(a: ApiAgreement): void {
    this.agreementForm.set({
      id: a.id,
      type: a.type,
      startDate: a.startDate ?? '',
      endDate: a.endDate ?? '',
      renewalDate: a.renewalDate ?? '',
      noticeDays: a.noticeDays,
      autoRenew: a.autoRenew,
      upgradesPerYear: a.upgradesPerYear,
      supportLevel: a.supportLevel ?? '',
      reference: a.reference ?? '',
      documentUrl: a.documentUrl ?? '',
      infrastructure: a.infrastructure ?? 'QUOTED',
      licensedUsers: a.licensedUsers,
      notes: a.notes ?? '',
    });
  }

  protected renew(a: ApiAgreement): void {
    const start = a.endDate ? addDays(a.endDate, 1) : new Date().toISOString().slice(0, 10);
    const years =
      a.startDate && a.endDate
        ? Math.max(1, Math.round((Date.parse(a.endDate) - Date.parse(a.startDate)) / (365.25 * 86_400_000)))
        : 1;
    this.editAgreement(a);
    this.agreementForm.update((f) =>
      f ? { ...f, id: undefined, startDate: start, endDate: addDays(addYears(start, years), -1), renewalDate: '', reference: '', documentUrl: '' } : f,
    );
  }

  protected setType(f: AgreementForm, type: AgreementType): void {
    this.agreementForm.set({ ...f, type, upgradesPerYear: type === 'LICENSE' ? null : f.upgradesPerYear });
  }



  protected suggestEnd(f: AgreementForm): void {
    if (f.startDate && !f.endDate) f.endDate = addDays(addYears(f.startDate, 5), -1);
  }

  protected saveAgreement(event: Event): void {
    event.preventDefault();
    const f = this.agreementForm();
    const c = this.customer();
    if (!f || !c) return;


    const body = {
      type: f.type,
      startDate: f.startDate || null,
      endDate: f.endDate || null,
      renewalDate: f.renewalDate || null,
      noticeDays: f.noticeDays === null || (f.noticeDays as unknown) === '' ? null : Number(f.noticeDays),
      autoRenew: f.autoRenew,
      upgradesPerYear: f.upgradesPerYear === null || (f.upgradesPerYear as unknown) === '' ? null : Number(f.upgradesPerYear),
      supportLevel: f.supportLevel || null,
      reference: f.reference.trim() || null,
      documentUrl: f.documentUrl.trim() || null,
      ...(f.type === 'LICENSE'
        ? {
            infrastructure: f.infrastructure,
            licensedUsers: f.licensedUsers === null || (f.licensedUsers as unknown) === '' ? null : Number(f.licensedUsers),
          }
        : {}),
      notes: f.notes.trim() || null,
    };

    this.busy.set(true);
    const request = f.id ? this.api.updateAgreement(c.id, f.id, body) : this.api.createAgreement(c.id, body);
    request.subscribe({
      next: () => {
        this.agreementForm.set(null);
        this.refresh(f.id ? 'Agreement saved.' : 'Agreement added.');
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save that agreement.');
      },
    });
  }

  protected async deleteAgreement(a: ApiAgreement): Promise<void> {
    const c = this.customer();
    if (!c) return;
    const ok = await this.feedback.confirm({
      title: `Delete this ${typeLabel(a.type).toLowerCase()}?`,
      message: `${this.date(a.startDate)} – ${this.date(a.endDate)}. Only for an agreement entered by mistake; renewals should be added as a new agreement.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    this.api.deleteAgreement(c.id, a.id).subscribe({
      next: () => this.refresh('Agreement deleted.'),
      error: (err) => this.feedback.failed(err, 'Could not delete that agreement.'),
    });
  }

  protected newContact(): void {
    this.contactForm.set({ name: '', role: '', email: '', phone: '', isPrimary: (this.customer()?.contacts.length ?? 0) === 0 });
  }

  protected editContact(person: ApiContact): void {
    this.contactForm.set({
      id: person.id,
      name: person.name,
      role: person.role ?? '',
      email: person.email ?? '',
      phone: person.phone ?? '',
      isPrimary: person.isPrimary,
    });
  }

  protected saveContact(event: Event): void {
    event.preventDefault();
    const f = this.contactForm();
    const c = this.customer();
    if (!f || !c || !f.name.trim()) return;

    const body = {
      name: f.name.trim(),
      role: f.role.trim() || null,
      email: f.email.trim() || null,
      phone: f.phone.trim() || null,
      isPrimary: f.isPrimary,
    };
    this.busy.set(true);
    const request = f.id ? this.api.updateContact(c.id, f.id, body) : this.api.createContact(c.id, body);
    request.subscribe({
      next: () => {
        this.contactForm.set(null);
        this.refresh(f.id ? 'Contact saved.' : 'Contact added.');
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save that contact.');
      },
    });
  }

  protected makePrimary(person: ApiContact): void {
    const c = this.customer();
    if (!c) return;
    this.api.updateContact(c.id, person.id, { isPrimary: true }).subscribe({
      next: () => this.refresh(`${person.name} is now the primary contact.`),
      error: (err) => this.feedback.failed(err, 'Could not change the primary contact.'),
    });
  }

  protected async deleteContact(person: ApiContact): Promise<void> {
    const c = this.customer();
    if (!c) return;
    const ok = await this.feedback.confirm({
      title: `Remove ${person.name}?`,
      message: person.isPrimary ? 'Another contact becomes primary.' : 'They will no longer be listed for this customer.',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    this.api.deleteContact(c.id, person.id).subscribe({
      next: () => this.refresh(`${person.name} removed.`),
      error: (err) => this.feedback.failed(err, 'Could not remove that contact.'),
    });
  }

  protected editDetails(c: ApiCustomerDetail): void {
    this.detailsForm.set({ name: c.name, code: c.code ?? '', notes: c.notes ?? '' });
  }

  protected saveDetails(event: Event): void {
    event.preventDefault();
    const f = this.detailsForm();
    const c = this.customer();
    if (!f || !c || !f.name.trim()) return;
    this.busy.set(true);
    this.api.editCustomer(c.id, { name: f.name.trim(), code: f.code.trim() || null, notes: f.notes.trim() || null }).subscribe({
      next: () => {
        this.detailsForm.set(null);
        this.refresh('Customer saved.');
      },
      error: (err) => {
        this.busy.set(false);
        this.feedback.failed(err, 'Could not save that customer.');
      },
    });
  }

  protected async archive(c: ApiCustomerDetail): Promise<void> {
    const ok = await this.feedback.confirm({
      title: `Archive ${c.name}?`,
      message: 'Only possible when the customer has no active projects. It can be restored later.',
      confirmLabel: 'Archive',
      destructive: true,
    });
    if (!ok) return;
    this.api.archiveCustomer(c.id).subscribe({
      next: () => {
        this.feedback.success(`${c.name} archived.`);
        this.api.reload();
        void this.router.navigateByUrl('/customers');
      },
      error: (err) => this.feedback.failed(err, `${c.name} could not be archived.`),
    });
  }
}

function addYears(value: string, years: number): string {
  const d = new Date(`${value}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear() + years, d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
