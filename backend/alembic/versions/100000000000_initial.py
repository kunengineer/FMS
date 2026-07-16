"""initial

Revision ID: 100000000000
Revises: 
Create Date: 2026-07-01 12:50:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ARRAY

revision: str = '100000000000'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. roles
    op.create_table(
        'roles',
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('role_name', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('role_id'),
        sa.UniqueConstraint('role_name')
    )
    op.create_index(op.f('ix_roles_role_id'), 'roles', ['role_id'], unique=False)

    # 2. permissions
    op.create_table(
        'permissions',
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.Column('permission_key', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('permission_id'),
        sa.UniqueConstraint('permission_key')
    )
    op.create_index(op.f('ix_permissions_permission_id'), 'permissions', ['permission_id'], unique=False)

    # 3. role_permissions
    op.create_table(
        'role_permissions',
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('permission_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.permission_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.role_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('role_id', 'permission_id')
    )

    # 4. operators
    op.create_table(
        'operators',
        sa.Column('operator_id', sa.String(length=20), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=False),
        sa.Column('department', sa.String(length=50), nullable=True),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('phone', sa.String(length=15), nullable=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.role_id'], ),
        sa.PrimaryKeyConstraint('operator_id')
    )

    # 5. vehicle_types
    op.create_table(
        'vehicle_types',
        sa.Column('vehicle_type_id', sa.Integer(), nullable=False),
        sa.Column('type_name', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('vehicle_type_id'),
        sa.UniqueConstraint('type_name')
    )
    op.create_index(op.f('ix_vehicle_types_vehicle_type_id'), 'vehicle_types', ['vehicle_type_id'], unique=False)

    # 6. vehicle_statuses
    op.create_table(
        'vehicle_statuses',
        sa.Column('status_code', sa.String(length=20), nullable=False),
        sa.Column('status_label', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('status_code')
    )

    # 7. vehicles
    op.create_table(
        'vehicles',
        sa.Column('vehicle_id', sa.UUID(), nullable=False),
        sa.Column('vehicle_code', sa.String(length=20), nullable=False),
        sa.Column('vehicle_name', sa.String(length=100), nullable=False),
        sa.Column('vehicle_type_id', sa.Integer(), nullable=False),
        sa.Column('model', sa.String(length=50), nullable=True),
        sa.Column('manufacture_year', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('current_hourmeter', sa.Numeric(precision=10, scale=1), nullable=False),
        sa.Column('last_maintenance_hourmeter', sa.Numeric(precision=10, scale=1), nullable=False),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['vehicle_status'], ['vehicle_statuses.status_code'], name='vehicles_status_fkey'),
        sa.ForeignKeyConstraint(['vehicle_type_id'], ['vehicle_types.vehicle_type_id'], ),
        sa.PrimaryKeyConstraint('vehicle_id'),
        sa.UniqueConstraint('vehicle_code')
    )
    # Correcting FK name on vehicle_statuses
    op.drop_constraint('vehicles_status_fkey', 'vehicles', type_='foreignkey')
    op.create_foreign_key('vehicles_status_fkey', 'vehicles', 'vehicle_statuses', ['status'], ['status_code'])

    # 8. shifts
    op.create_table(
        'shifts',
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('shift_name', sa.String(length=20), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.PrimaryKeyConstraint('shift_id'),
        sa.UniqueConstraint('shift_name')
    )
    op.create_index(op.f('ix_shifts_shift_id'), 'shifts', ['shift_id'], unique=False)

    # 9. condition_statuses
    op.create_table(
        'condition_statuses',
        sa.Column('status_code', sa.String(length=20), nullable=False),
        sa.Column('status_label', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('status_code')
    )

    # 10. operation_logs
    op.create_table(
        'operation_logs',
        sa.Column('operation_id', sa.BigInteger(), nullable=False),
        sa.Column('vehicle_id', sa.UUID(), nullable=False),
        sa.Column('operator_id', sa.String(length=20), nullable=False),
        sa.Column('shift_id', sa.Integer(), nullable=False),
        sa.Column('work_date', sa.Date(), nullable=False),
        sa.Column('start_hour', sa.Time(), nullable=False),
        sa.Column('end_hour', sa.Time(), nullable=True),
        sa.Column('hourmeter_start', sa.Numeric(precision=10, scale=1), nullable=False),
        sa.Column('hourmeter_end', sa.Numeric(precision=10, scale=1), nullable=True),
        sa.Column('condition_before_shift', sa.String(length=20), nullable=False),
        sa.Column('is_safety_confirmed', sa.Boolean(), nullable=False),
        sa.Column('signature_data', sa.Text(), nullable=True),
        sa.Column('signature_time', sa.DateTime(), nullable=True),
        sa.Column('acknowledged_previous_failure', sa.Boolean(), nullable=False),
        sa.Column('acknowledged_by', sa.String(length=20), nullable=True),
        sa.Column('idempotency_key', sa.UUID(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['acknowledged_by'], ['operators.operator_id'], ),
        sa.ForeignKeyConstraint(['condition_before_shift'], ['condition_statuses.status_code'], ),
        sa.ForeignKeyConstraint(['operator_id'], ['operators.operator_id'], ),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.shift_id'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.vehicle_id'], ),
        sa.PrimaryKeyConstraint('operation_id'),
        sa.UniqueConstraint('idempotency_key'),
        sa.UniqueConstraint('vehicle_id', 'work_date', 'shift_id', name='uq_vehicle_date_shift')
    )

    # 11. operation_log_operators
    op.create_table(
        'operation_log_operators',
        sa.Column('operation_id', sa.BigInteger(), nullable=False),
        sa.Column('operator_id', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(['operation_id'], ['operation_logs.operation_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['operator_id'], ['operators.operator_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('operation_id', 'operator_id')
    )

    # 12. checklist_items
    op.create_table(
        'checklist_items',
        sa.Column('checklist_id', sa.Integer(), nullable=False),
        sa.Column('item_name', sa.String(length=100), nullable=False),
        sa.Column('applies_to_vehicle_types', ARRAY(sa.Integer()), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint('checklist_id'),
        sa.UniqueConstraint('item_name')
    )
    op.create_index(op.f('ix_checklist_items_checklist_id'), 'checklist_items', ['checklist_id'], unique=False)

    # 13. checklist_results
    op.create_table(
        'checklist_results',
        sa.Column('result_id', sa.BigInteger(), nullable=False),
        sa.Column('operation_id', sa.BigInteger(), nullable=False),
        sa.Column('checklist_id', sa.Integer(), nullable=False),
        sa.Column('result', sa.Boolean(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['checklist_id'], ['checklist_items.checklist_id'], ),
        sa.ForeignKeyConstraint(['operation_id'], ['operation_logs.operation_id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('result_id')
    )

    # 14. severity_levels
    op.create_table(
        'severity_levels',
        sa.Column('severity_code', sa.String(length=20), nullable=False),
        sa.Column('severity_label', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('severity_code')
    )

    # 15. failure_phases
    op.create_table(
        'failure_phases',
        sa.Column('phase_code', sa.String(length=20), nullable=False),
        sa.Column('phase_label', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('phase_code')
    )

    # 16. failure_categories
    op.create_table(
        'failure_categories',
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('category_name', sa.String(length=100), nullable=False),
        sa.Column('severity_default', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(['severity_default'], ['severity_levels.severity_code'], ),
        sa.PrimaryKeyConstraint('category_id'),
        sa.UniqueConstraint('category_name')
    )
    op.create_index(op.f('ix_failure_categories_category_id'), 'failure_categories', ['category_id'], unique=False)

    # 17. failure_logs
    op.create_table(
        'failure_logs',
        sa.Column('failure_id', sa.BigInteger(), nullable=False),
        sa.Column('operation_id', sa.BigInteger(), nullable=True),
        sa.Column('vehicle_id', sa.UUID(), nullable=False),
        sa.Column('category_id', sa.Integer(), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('failure_time', sa.DateTime(), nullable=False),
        sa.Column('severity', sa.String(length=20), nullable=False),
        sa.Column('phase', sa.String(length=20), nullable=False),
        sa.Column('is_repaired', sa.Boolean(), nullable=False),
        sa.Column('transferred_to_next_shift', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['failure_categories.category_id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['operators.operator_id'], ),
        sa.ForeignKeyConstraint(['operation_id'], ['operation_logs.operation_id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['phase'], ['failure_phases.phase_code'], ),
        sa.ForeignKeyConstraint(['severity'], ['severity_levels.severity_code'], ),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.vehicle_id'], ),
        sa.PrimaryKeyConstraint('failure_id')
    )

    # 18. failure_attachments
    op.create_table(
        'failure_attachments',
        sa.Column('attachment_id', sa.BigInteger(), nullable=False),
        sa.Column('failure_id', sa.BigInteger(), nullable=False),
        sa.Column('file_path', sa.String(length=255), nullable=False),
        sa.Column('uploaded_by', sa.String(length=20), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['failure_id'], ['failure_logs.failure_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['operators.operator_id'], ),
        sa.PrimaryKeyConstraint('attachment_id')
    )

    # 19. repair_statuses
    op.create_table(
        'repair_statuses',
        sa.Column('status_code', sa.String(length=20), nullable=False),
        sa.Column('status_label', sa.String(length=50), nullable=False),
        sa.PrimaryKeyConstraint('status_code')
    )

    # 20. repair_logs
    op.create_table(
        'repair_logs',
        sa.Column('repair_id', sa.BigInteger(), nullable=False),
        sa.Column('failure_id', sa.BigInteger(), nullable=False),
        sa.Column('mechanic_id', sa.String(length=20), nullable=False),
        sa.Column('repair_start', sa.DateTime(), nullable=False),
        sa.Column('repair_end', sa.DateTime(), nullable=True),
        sa.Column('repaired_in_shift', sa.Boolean(), nullable=False),
        sa.Column('parts_used', sa.Text(), nullable=True),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('repair_status', sa.String(length=20), nullable=False),
        sa.ForeignKeyConstraint(['failure_id'], ['failure_logs.failure_id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['mechanic_id'], ['operators.operator_id'], ),
        sa.ForeignKeyConstraint(['repair_status'], ['repair_statuses.status_code'], ),
        sa.PrimaryKeyConstraint('repair_id')
    )

    # 21. system_settings
    op.create_table(
        'system_settings',
        sa.Column('setting_id', sa.Integer(), nullable=False),
        sa.Column('key', sa.String(length=50), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('setting_id'),
        sa.UniqueConstraint('key')
    )
    op.create_index(op.f('ix_system_settings_setting_id'), 'system_settings', ['setting_id'], unique=False)

    # 22. audit_logs
    op.create_table(
        'audit_logs',
        sa.Column('audit_id', sa.BigInteger(), nullable=False),
        sa.Column('operator_id', sa.String(length=20), nullable=True),
        sa.Column('table_name', sa.String(length=50), nullable=False),
        sa.Column('record_id', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=20), nullable=False),
        sa.Column('old_value', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_value', JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['operator_id'], ['operators.operator_id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('audit_id')
    )

    # 23. idempotency_keys
    op.create_table(
        'idempotency_keys',
        sa.Column('key', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('key')
    )


def downgrade() -> None:
    op.drop_table('idempotency_keys')
    op.drop_table('audit_logs')
    op.drop_index(op.f('ix_system_settings_setting_id'), table_name='system_settings')
    op.drop_table('system_settings')
    op.drop_table('repair_logs')
    op.drop_table('repair_statuses')
    op.drop_table('failure_attachments')
    op.drop_table('failure_logs')
    op.drop_index(op.f('ix_failure_categories_category_id'), table_name='failure_categories')
    op.drop_table('failure_categories')
    op.drop_table('failure_phases')
    op.drop_table('severity_levels')
    op.drop_table('checklist_results')
    op.drop_index(op.f('ix_checklist_items_checklist_id'), table_name='checklist_items')
    op.drop_table('checklist_items')
    op.drop_table('operation_log_operators')
    op.drop_table('operation_logs')
    op.drop_table('condition_statuses')
    op.drop_index(op.f('ix_shifts_shift_id'), table_name='shifts')
    op.drop_table('shifts')
    op.drop_table('vehicles')
    op.drop_table('vehicle_statuses')
    op.drop_index(op.f('ix_vehicle_types_vehicle_type_id'), table_name='vehicle_types')
    op.drop_table('vehicle_types')
    op.drop_table('operators')
    op.drop_table('role_permissions')
    op.drop_index(op.f('ix_permissions_permission_id'), table_name='permissions')
    op.drop_table('permissions')
    op.drop_index(op.f('ix_roles_role_id'), table_name='roles')
    op.drop_table('roles')
