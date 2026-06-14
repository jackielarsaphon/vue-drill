import { defineStore } from 'pinia'
import { createCrudStore } from '../lib/createCrudStore'

function toDbRow(e: any) {
  return {
    week_id:     Number(e.week_id),
    work_date:   e.work_date,
    shift:       e.shift ?? 'day',
    air_code:    e.air_code ?? '',
    reason_code: e.reason_code ?? '',
    operator:    e.operator ?? '',
    start_time:  e.start_time ?? '',
    end_time:    e.end_time ?? '',
    sum_hr:      Number(e.sum_hr) || 0,
    remark:      e.remark ?? '',
  }
}

export const useDownTimeStore = defineStore('downTime', () => {
  return createCrudStore({ table: 'tdl_downtime', toDbRow, startId: 80000 })
})
