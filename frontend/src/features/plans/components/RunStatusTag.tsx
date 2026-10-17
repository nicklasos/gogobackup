import { Tag, Tooltip, Typography } from 'antd'
import { useTranslation } from 'react-i18next'
import { enumLabel } from '@/shared/utils/enums'
import { formatBytes, formatUtcDateTime } from '@/shared/utils/format'
import { RUN_STATUS_COLOR } from '../runStatus'
import type { Plan } from '../types'

/** The status of a plan's latest run; `data-status` carries it for tests. */
export function RunStatusTag({ plan }: { plan: Plan }) {
  const { t } = useTranslation()
  const run = plan.last_run
  const testId = `plan-run-status-${plan.id}`
  if (!run) {
    return (
      <Typography.Text type="secondary" data-testid={testId} data-status="none">
        {t('plans.neverRun')}
      </Typography.Text>
    )
  }
  const when = run.finished_at ?? run.started_at
  const details = [
    when ? formatUtcDateTime(when) : null,
    run.size_bytes != null ? formatBytes(run.size_bytes) : null,
    enumLabel(t, 'runTrigger', run.trigger),
  ].filter(Boolean)
  return (
    <Tooltip title={details.join(' · ')}>
      <Tag bordered={false} color={RUN_STATUS_COLOR[run.status]} data-testid={testId} data-status={run.status}>
        {enumLabel(t, 'runStatus', run.status)}
      </Tag>
    </Tooltip>
  )
}
