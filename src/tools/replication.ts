import type { PostgresClient } from '../client/postgres-client.js';

export const replicationToolDefinitions = [
  {
    name: 'pg_replication_status',
    description: 'Show streaming replication state and lag. On primary: shows connected replicas. On standby: shows receiver status.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_replication_slots',
    description: 'List replication slots with active status, restart LSN, and slot type. Detects orphaned slots.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_wal_status',
    description: 'Show WAL generation rate, current LSN, and archive status.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'pg_standby_status',
    description: 'Check if this instance is primary or standby, with timeline and recovery information.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
];

export async function handleReplicationTool(
  name: string,
  _args: Record<string, unknown>,
  client: PostgresClient,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    switch (name) {
      case 'pg_replication_status': {
        const isStandby = await client.query('SELECT pg_is_in_recovery() AS is_standby');
        if (isStandby.rows[0]?.is_standby) {
          const result = await client.query(
            `SELECT status, receive_start_lsn, received_lsn, last_msg_send_time, last_msg_receipt_time, conninfo
             FROM pg_stat_wal_receiver`
          );
          return { content: [{ type: 'text', text: JSON.stringify({ role: 'standby', receiver: result.rows }, null, 2) }] };
        }
        const result = await client.query(
          `SELECT pid, usesysid, usename, application_name, client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
                  sent_lsn - replay_lsn AS replay_lag_bytes, sync_state
           FROM pg_stat_replication ORDER BY application_name`
        );
        return { content: [{ type: 'text', text: JSON.stringify({ role: 'primary', replicas: result.rows }, null, 2) }] };
      }

      case 'pg_replication_slots': {
        const result = await client.query(
          `SELECT slot_name, slot_type, active, restart_lsn, confirmed_flush_lsn, wal_status,
                  pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS lag_bytes
           FROM pg_replication_slots ORDER BY slot_name`
        );
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      }

      case 'pg_wal_status': {
        const lsn = await client.query('SELECT pg_current_wal_lsn() AS current_lsn');
        const archiver = await client.query(
          `SELECT archived_count, failed_count, last_archived_wal, last_archived_time, last_failed_wal, last_failed_time
           FROM pg_stat_archiver`
        );
        return { content: [{ type: 'text', text: JSON.stringify({
          current_lsn: lsn.rows[0]?.current_lsn,
          archiver: archiver.rows[0],
        }, null, 2) }] };
      }

      case 'pg_standby_status': {
        const recovery = await client.query('SELECT pg_is_in_recovery() AS is_standby');
        const isStandby = recovery.rows[0]?.is_standby;
        if (isStandby) {
          const info = await client.query(
            `SELECT pg_last_wal_receive_lsn() AS last_receive_lsn,
                    pg_last_wal_replay_lsn() AS last_replay_lsn,
                    pg_last_xact_replay_timestamp() AS last_replay_timestamp`
          );
          return { content: [{ type: 'text', text: JSON.stringify({ role: 'standby', ...info.rows[0] }, null, 2) }] };
        }
        return { content: [{ type: 'text', text: JSON.stringify({ role: 'primary', is_standby: false }, null, 2) }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown replication tool: ${name}` }] };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: [{ type: 'text', text: `Error executing ${name}: ${msg}` }] };
  }
}
