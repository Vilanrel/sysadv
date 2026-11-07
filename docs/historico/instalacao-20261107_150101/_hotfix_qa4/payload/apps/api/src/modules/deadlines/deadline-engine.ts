/** Pure, deterministic calendar-day engine. Dates use YYYY-MM-DD, never JS local midnight. */
export type Branch = 'CIVIL' | 'BUSINESS' | 'CRIMINAL' | 'LABOR' | 'SOCIAL_SECURITY_ADMIN' | 'INSOLVENCY';
export type Nature = 'PROCESSUAL' | 'MATERIAL' | 'ADMINISTRATIVE';
export type CountMode = 'BUSINESS_DAYS' | 'CALENDAR_DAYS' | 'YEARS' | 'FIXED_EVENT';
export type RollMode = 'NEXT_BUSINESS' | 'NONE';
export type DoubleBasis = 'NONE' | 'PUBLIC_ENTITY' | 'PUBLIC_DEFENDER' | 'SEPARATE_COUNSEL';
export type FileFormat = 'ELECTRONIC' | 'PAPER';
export type LegalRule = {
  code: string; version: number; label: string; branch: Branch; nature: Nature;
  countMode: CountMode; quantity: number; endRoll: RollMode;
  recess: boolean; doubleEligible: boolean; trigger: string; sourceUrl: string;
  caveat: string; active: boolean;
};
export type CalendarInfo = {
  holidays: string[];
  suspensions?: { from: string; to: string }[];
  verifiedYears: number[];
};
export type PreviewInput = {
  anchorDate: string;
  // The actual, verified act/date that starts the legal term, NOT a fetch timestamp.
  anchorEvidence: string;
  court?: string;
  state?: string;
  city?: string;
  fileFormat: FileFormat;
  doubleBasis: DoubleBasis;
  doubleJustification?: string;
  fixedDueAt?: string;
  internalBusinessDays?: number;
};
export type PreviewResult = {
  ruleCode: string; ruleVersion: number; anchorDate: string;
  dueDate: string | null; fixedDueAt: string | null; internalDate: string | null;
  alertDates: { kind: string; on: string }[];
  countMode: CountMode; quantityApplied: number;
  reviewed: false; state: 'PENDING_REVIEW';
  calendarCoverage: 'VERIFIED' | 'UNVERIFIED'; warnings: string[];
  explanations: string[];
};
export class DeadlineRuleError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const isValidDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const obj = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(obj.valueOf()) && obj.toISOString().slice(0, 10) === date;
};
export const validDeadlineDate = isValidDate;
const dateObj = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const addCalendarDays = (s: string, delta: number) => {
  if (!isValidDate(s) || !Number.isInteger(delta)) throw new DeadlineRuleError('INVALID_DATE');
  const d = dateObj(s); d.setUTCDate(d.getUTCDate() + delta); return d.toISOString().slice(0, 10);
};
const dayOfWeek = (s: string) => dateObj(s).getUTCDay();
const isWeekend = (s: string) => [0, 6].includes(dayOfWeek(s));
const isRecess = (s: string) => { const m = s.slice(5); return m >= '12-20' || m <= '01-20'; };
const isSuspended = (s: string, c: CalendarInfo) => (c.suspensions ?? []).some(x => x.from <= s && s <= x.to);
const isBusinessDay = (s: string, c: CalendarInfo, recess = false) =>
  !isWeekend(s) && !c.holidays.includes(s) && !isSuspended(s, c) && (!recess || !isRecess(s));
export function addBusinessDays(anchor: string, quantity: number, calendar: CalendarInfo, recess: boolean, direction: 1 | -1 = 1): string {
  if (!isValidDate(anchor) || !Number.isInteger(quantity) || quantity < 0 || quantity > 10000) throw new DeadlineRuleError('INVALID_QUANTITY');
  let date = anchor; let counted = 0;
  for (let safety = 0; counted < quantity && safety < 15000; safety++) {
    date = addCalendarDays(date, direction);
    if (isBusinessDay(date, calendar, recess)) counted++;
  }
  if (counted < quantity) throw new DeadlineRuleError('CALENDAR_EXHAUSTED');
  return date;
}
function rollEnd(s: string, c: CalendarInfo) {
  let due = s;
  for (let i = 0; i < 370 && !isBusinessDay(due, c); i++) due = addCalendarDays(due, 1);
  if (!isBusinessDay(due, c)) throw new DeadlineRuleError('NO_BUSINESS_DAY_FOUND');
  return due;
}
function addYears(anchor: string, years: number) {
  const orig = dateObj(anchor);
  const year = orig.getUTCFullYear() + years;
  const month = orig.getUTCMonth();
  const day = Math.min(orig.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}
function requireDoubleEligibility(rule: LegalRule, input: PreviewInput) {
  if (input.doubleBasis === 'NONE') return 1;
  if (!rule.doubleEligible || rule.nature !== 'PROCESSUAL' || (rule.branch !== 'CIVIL' && rule.branch !== 'BUSINESS'))
    throw new DeadlineRuleError('DOUBLE_NOT_APPLICABLE_TO_THIS_RULE');
  if (!input.doubleJustification || input.doubleJustification.trim().length < 12)
    throw new DeadlineRuleError('DOUBLE_REQUIRES_FACTUAL_JUSTIFICATION');
  if (input.doubleBasis === 'SEPARATE_COUNSEL' && input.fileFormat !== 'PAPER')
    throw new DeadlineRuleError('ARTICLE_229_EXCLUDES_ELECTRONIC_CASES');
  return 2;
}
function missingVerifiedYears(anchor: string, end: string, verified: number[]) {
  const years = [];
  for (let y = Number(anchor.slice(0, 4)); y <= Number(end.slice(0, 4)); y++) {
    if (!verified.includes(y)) years.push(y);
  }
  return years;
}
export function calculateDeadline(rule: LegalRule, input: PreviewInput, calendar: CalendarInfo): PreviewResult {
  if (!rule.active) throw new DeadlineRuleError('RULE_INACTIVE');
  if (!isValidDate(input.anchorDate)) throw new DeadlineRuleError('INVALID_ANCHOR_DATE');
  if ((input.anchorEvidence ?? '').trim().length < 8) throw new DeadlineRuleError('ANCHOR_EVIDENCE_REQUIRED');
  if (!['ELECTRONIC', 'PAPER'].includes(input.fileFormat)) throw new DeadlineRuleError('INVALID_FILE_FORMAT');
  if (!['NONE', 'PUBLIC_ENTITY', 'PUBLIC_DEFENDER', 'SEPARATE_COUNSEL'].includes(input.doubleBasis)) throw new DeadlineRuleError('INVALID_DOUBLE_BASIS');
  if (!Number.isInteger(rule.quantity) || rule.quantity < 0 || (rule.countMode === 'BUSINESS_DAYS' && rule.quantity > 1000) || (rule.countMode === 'YEARS' && rule.quantity > 10) || (rule.countMode === 'CALENDAR_DAYS' && rule.quantity > 5000) || (rule.countMode === 'FIXED_EVENT' && rule.quantity !== 0)) throw new DeadlineRuleError('INVALID_RULE_QUANTITY');
  const multiplier = requireDoubleEligibility(rule, input);
  const quantityApplied = rule.quantity * multiplier;
  const warnings = ['LEGAL_REVIEW_MANDATORY', 'TRIGGER_AND_INTIMATION_MUST_BE_VERIFIED'];
  const explanations = [rule.caveat, `Fonte da regra: ${rule.sourceUrl}`, `Gatilho exigido: ${rule.trigger}`];
  if (multiplier === 2) warnings.push('DOUBLE_TIME_REQUIRES_DOCUMENTED_ELIGIBILITY');
  if (rule.recess) warnings.push('VERIFY_LOCAL_RECESS_EXCEPTIONS');
  if (rule.nature === 'MATERIAL') warnings.push('MATERIAL_PERIOD_REQUIRES_INDIVIDUAL_REVIEW');
  let due: string | null = null;
  let fixedDueAt: string | null = null;
  if (rule.countMode === 'BUSINESS_DAYS') {
    due = addBusinessDays(input.anchorDate, quantityApplied, calendar, rule.recess);
  } else if (rule.countMode === 'CALENDAR_DAYS') {
    due = addCalendarDays(input.anchorDate, quantityApplied);
    if (rule.endRoll === 'NEXT_BUSINESS') due = rollEnd(due, calendar);
  } else if (rule.countMode === 'YEARS') {
    due = addYears(input.anchorDate, quantityApplied);
    if (rule.endRoll === 'NEXT_BUSINESS') due = rollEnd(due, calendar);
  } else if (rule.countMode === 'FIXED_EVENT') {
    if (!input.fixedDueAt || !/^\d{4}-\d{2}-\d{2}T/.test(input.fixedDueAt) || Number.isNaN(Date.parse(input.fixedDueAt)))
      throw new DeadlineRuleError('HEARING_DEADLINE_DATETIME_REQUIRED');
    fixedDueAt = input.fixedDueAt;
    due = input.fixedDueAt.slice(0, 10);
    if (!isValidDate(due)) throw new DeadlineRuleError('INVALID_HEARING_DATE');
    warnings.push('HEARING_TIME_AND_TIMEZONE_REQUIRE_REVIEW');
  }
  if (!due) throw new DeadlineRuleError('MISSING_DUE_DATE');
  const internalDays = input.internalBusinessDays ?? 2;
  if (!Number.isInteger(internalDays) || internalDays < 0 || internalDays > 20) throw new DeadlineRuleError('INVALID_INTERNAL_OFFSET');
  const internalDate = internalDays ? addBusinessDays(due, internalDays, calendar, rule.recess && rule.nature === 'PROCESSUAL', -1) : due;
  const firstDay = input.anchorDate < internalDate ? input.anchorDate : internalDate;
  const missing = missingVerifiedYears(firstDay, due, calendar.verifiedYears);
  if (missing.length) warnings.push(`CALENDAR_COVERAGE_NOT_VERIFIED:${missing.join(',')}`);
  // A state/tribunal-wide calendar entry is not proof of municipal holiday
  // coverage. A blank municipality permits a preview but prevents approval.
  const cityMissing = !input.city?.trim();
  if (cityMissing) warnings.push('MUNICIPAL_CALENDAR_SCOPE_NOT_VERIFIED');
  const courtOrStateMissing = !input.court?.trim() || !input.state?.trim();
  if (courtOrStateMissing) warnings.push('COURT_AND_STATE_SCOPE_INCOMPLETE');
  const alertDates = [5, 3, 1].map(n => ({kind: `HARD_D${n}`, on: addCalendarDays(due!, -n)}));
  alertDates.push({kind: 'INTERNAL_DUE', on: internalDate});
  return {ruleCode: rule.code, ruleVersion: rule.version, anchorDate: input.anchorDate,
    dueDate: due, fixedDueAt, internalDate, alertDates, countMode: rule.countMode,
    quantityApplied, reviewed: false, state: 'PENDING_REVIEW',
    calendarCoverage: (missing.length || cityMissing || courtOrStateMissing) ? 'UNVERIFIED' : 'VERIFIED',
    warnings, explanations};
}
