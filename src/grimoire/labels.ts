import type { PostponeReason, TaskOwnerKind, TaskSlot, TaskSource, TaskStatus, Want } from './types'

export const dreadLabel = ['норм', 'лень', 'не хочу', 'чудовище'] as const

export const slotLabel: Record<TaskSlot, string> = { main: 'главное', extra: 'дополнительное', optional: 'необязательное' }

export const statusLabel: Record<TaskStatus, string> = {
  open: 'открыто',
  inProgress: 'в работе',
  partial: 'сделана часть',
  waiting: 'ждёт ответа или события',
  done: 'выполнено',
  cancelled: 'отпущено',
}

export const postponeReasonLabel: Record<PostponeReason, string> = {
  unclear: 'неясный результат',
  tooBig: 'слишком большое',
  unpleasant: 'неприятно',
  hardToDecide: 'трудно решить',
  needTalk: 'нужно общаться',
  noPlace: 'нет места',
  noEnergy: 'нет сил',
  dontKnow: 'не знаю',
}

export const wantLabel: Record<Want, string> = { want: 'хочу', need: 'надо', unsure: 'не знаю' }

export const ownerKindLabel: Record<TaskOwnerKind, string> = { mine: 'моя', person: 'человек', work: 'работа', other: 'другое' }

export const sourceLabel: Record<TaskSource, string> = {
  manual: 'вручную',
  project: 'проект',
  habit: 'ритуал',
  wish: 'хотелка',
  wheel: 'колесо года',
  workshop: 'мастерская',
}

export const whyOptions = ['реальный срок', 'последствия', 'мешает жить', 'открывает дорогу']
export const costOptions = ['нужно решение', 'общение', 'подготовка', 'выход из дома']

/** Step types offered by «Расколоть». */
export const stepKinds = ['решить', 'подготовить', 'сделать', 'связаться', 'ждать', 'найти информацию', 'купить']
