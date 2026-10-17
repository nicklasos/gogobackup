import { Button, Card, Space, Tag, Typography } from 'antd'
import { PlusOutlined, ScheduleOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/shared/components/PageHeader'
import { PageStack } from '@/shared/components/PageStack'
import { ResponsiveTable } from '@/shared/components/ResponsiveTable'
import { RowActions } from '@/shared/components/RowActions'
import { usePageParams, useTablePagination } from '@/shared/hooks/usePageParams'
import { enumLabel } from '@/shared/utils/enums'
import { formatUtcDateTime } from '@/shared/utils/format'
import message from '@/shared/utils/message'
import { RunNowButton } from '../components/RunNowButton'
import { RunStatusTag } from '../components/RunStatusTag'
import { useDeletePlan, usePlans } from '../hooks'
import { scheduleSummary } from '../schedule'
import type { Plan } from '../types'

export default function PlansPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const paging = usePageParams()
  const plans = usePlans(paging.params)
  const remove = useDeletePlan()
  const pagination = useTablePagination(paging, plans.data)

  const onDelete = (plan: Plan) => remove.mutate(plan.id, { onSuccess: () => message.success(t('plans.deleted')) })

  const kindTag = (plan: Plan) => (
    <Tag bordered={false} color="processing" data-testid={`plan-kind-${plan.id}`}>
      {enumLabel(t, 'sourceKind', plan.source_kind)}
    </Tag>
  )

  const schedule = (plan: Plan) => <span data-testid={`plan-schedule-${plan.id}`}>{scheduleSummary(t, plan.schedules)}</span>

  const nextRun = (plan: Plan) => {
    if (plan.next_run_at) return <span data-testid={`plan-next-run-${plan.id}`}>{formatUtcDateTime(plan.next_run_at)}</span>
    return (
      <Typography.Text type="secondary" data-testid={`plan-next-run-${plan.id}`}>
        {plan.enabled ? t('plans.manual') : t('plans.paused')}
      </Typography.Text>
    )
  }

  const storages = (plan: Plan) => (
    <Space size={[4, 4]} wrap>
      {plan.storages.map((storage) => (
        <Tag key={storage.id} bordered={false}>
          {storage.name}
        </Tag>
      ))}
    </Space>
  )

  const enabled = (plan: Plan) => (
    <Tag bordered={false} color={plan.enabled ? 'success' : 'default'} data-testid={`plan-enabled-${plan.id}`}>
      {plan.enabled ? t('plans.on') : t('plans.off')}
    </Tag>
  )

  const actions = (plan: Plan) => (
    <RowActions
      entity="plan"
      id={plan.id}
      onEdit={() => navigate(`/plans/${plan.id}/edit`)}
      onDelete={() => onDelete(plan)}
      deleteTitle={t('plans.deleteConfirm')}
      deleteDescription={t('plans.deleteHint')}
    >
      <RunNowButton plan={plan} compact />
    </RowActions>
  )

  const columns: ColumnsType<Plan> = [
    { title: t('plans.nameField'), dataIndex: 'name', key: 'name' },
    { title: t('plans.source'), key: 'source', render: (_, plan) => kindTag(plan) },
    { title: t('plans.schedules'), key: 'schedule', render: (_, plan) => schedule(plan) },
    { title: t('plans.lastRunColumn'), key: 'lastRun', render: (_, plan) => <RunStatusTag plan={plan} /> },
    { title: t('plans.nextRunColumn'), key: 'next', render: (_, plan) => nextRun(plan) },
    { title: t('plans.storagesColumn'), key: 'storages', width: 240, render: (_, plan) => storages(plan) },
    { title: t('plans.enabledColumn'), key: 'enabled', render: (_, plan) => enabled(plan) },
    { title: t('common.actions'), key: 'actions', width: 130, fixed: 'right', render: (_, plan) => actions(plan) },
  ]

  return (
    <PageStack testId="plans-page">
      <Card>
        <PageHeader
          icon={<ScheduleOutlined />}
          title={t('plans.title')}
          subtitle={t('plans.subtitle')}
          mainAction={
            <Button data-testid="plans-add-button" type="primary" icon={<PlusOutlined />} onClick={() => navigate('/plans/new')}>
              {t('plans.add')}
            </Button>
          }
        />
        <ResponsiveTable
          testId="plans-table"
          items={plans.data?.data}
          loading={plans.isLoading || plans.isPlaceholderData || remove.isPending}
          columns={columns}
          emptyText={t('plans.empty')}
          pagination={pagination}
          cardTitle={(plan) => plan.name}
          cardExtra={kindTag}
          cardTestId={(plan) => `plan-card-${plan.id}`}
          renderCard={(plan) => (
            <>
              <div>
                <RunStatusTag plan={plan} />
              </div>
              <div>{schedule(plan)}</div>
              <div>
                {nextRun(plan)} {enabled(plan)}
              </div>
              <div>{storages(plan)}</div>
            </>
          )}
          cardActions={actions}
        />
      </Card>
    </PageStack>
  )
}
