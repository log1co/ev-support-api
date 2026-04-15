'use strict'

exports.config = {
  app_name: ['EV Support API'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  logging: {
    level: 'info'
  },
  distributed_tracing: {
    enabled: true
  },
  error_collector: {
    enabled: true,
    ignore_status_codes: [],
    expected_status_codes: [],
    capture_events: true
  }
}