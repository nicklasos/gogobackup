import { Button, Tooltip } from 'antd'
import { CaretRightOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import message from '@/shared/utils/message'
import { useRunPlan } from '../hooks'
import { isRunActive } from '../runStatus'
import type { Plan } from '../types'

/** Queues a backup of the plan. Off while one is queued or running; `compact` is the icon button of a table row. */
export function RunNowButton({ plan, compact = false }: { plan: Plan; compact?: boolean }) {
  const { t } = useTranslation()
  const run = useRunPlan()
  const busy = isRunActive(plan.last_run)
  const onClick = () => run.mutate(plan.id, { onSuccess: () => message.success(t('plans.runQueued')) })
  const testId = compact ? `run-plan-button-${plan.id}` : 'plan-run-button'

  if (compact) {
    return (
      <Tooltip title={busy ? t('plans.runBusy') : t('plans.runNow')}>
        <Button type="text" size="small" icon={<CaretRightOutlined />} onClick={onClick} loading={run.isPending} disabled={busy} data-testid={testId} />
      </Tooltip>
    )
  }
  return (
    <Button icon={<CaretRightOutlined />} onClick={onClick} loading={run.isPending} disabled={busy} data-testid={testId}>
      {busy ? t('plans.runBusy') : t('plans.runNow')}
    </Button>
  )
}
