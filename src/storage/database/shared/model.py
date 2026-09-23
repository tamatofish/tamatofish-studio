from coze_coding_dev_sdk.database import Base

from sqlalchemy import BigInteger, Boolean, Column, DateTime, Double, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, Uuid, text
from sqlalchemy.dialects.postgresql import OID
from typing import Optional
import datetime
import uuid

from sqlalchemy.orm import Mapped, mapped_column, relationship

class HealthCheck(Base):
    __tablename__ = 'health_check'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='health_check_pkey'),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))


class InternalMembers(Base):
    __tablename__ = 'internal_members'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='internal_members_pkey'),
        Index('internal_members_member_no_unique_idx', 'member_no', postgresql_where='(member_no IS NOT NULL)', unique=True),
        Index('internal_members_status_idx', 'status'),
        Index('internal_members_user_id_idx', 'user_id')
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, server_default=text('gen_random_uuid()'))
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, server_default=text('auth.uid()'))
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'active'::character varying"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    title: Mapped[Optional[str]] = mapped_column(String(128))
    department: Mapped[Optional[str]] = mapped_column(String(128))
    email: Mapped[Optional[str]] = mapped_column(String(255))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    member_no: Mapped[Optional[str]] = mapped_column(String(32))


t_pg_stat_statements = Table(
    'pg_stat_statements', Base.metadata,
    Column('userid', OID),
    Column('dbid', OID),
    Column('toplevel', Boolean),
    Column('queryid', BigInteger),
    Column('query', Text),
    Column('plans', BigInteger),
    Column('total_plan_time', Double(53)),
    Column('min_plan_time', Double(53)),
    Column('max_plan_time', Double(53)),
    Column('mean_plan_time', Double(53)),
    Column('stddev_plan_time', Double(53)),
    Column('calls', BigInteger),
    Column('total_exec_time', Double(53)),
    Column('min_exec_time', Double(53)),
    Column('max_exec_time', Double(53)),
    Column('mean_exec_time', Double(53)),
    Column('stddev_exec_time', Double(53)),
    Column('rows', BigInteger),
    Column('shared_blks_hit', BigInteger),
    Column('shared_blks_read', BigInteger),
    Column('shared_blks_dirtied', BigInteger),
    Column('shared_blks_written', BigInteger),
    Column('local_blks_hit', BigInteger),
    Column('local_blks_read', BigInteger),
    Column('local_blks_dirtied', BigInteger),
    Column('local_blks_written', BigInteger),
    Column('temp_blks_read', BigInteger),
    Column('temp_blks_written', BigInteger),
    Column('shared_blk_read_time', Double(53)),
    Column('shared_blk_write_time', Double(53)),
    Column('local_blk_read_time', Double(53)),
    Column('local_blk_write_time', Double(53)),
    Column('temp_blk_read_time', Double(53)),
    Column('temp_blk_write_time', Double(53)),
    Column('wal_records', BigInteger),
    Column('wal_fpi', BigInteger),
    Column('wal_bytes', Numeric),
    Column('jit_functions', BigInteger),
    Column('jit_generation_time', Double(53)),
    Column('jit_inlining_count', BigInteger),
    Column('jit_inlining_time', Double(53)),
    Column('jit_optimization_count', BigInteger),
    Column('jit_optimization_time', Double(53)),
    Column('jit_emission_count', BigInteger),
    Column('jit_emission_time', Double(53)),
    Column('jit_deform_count', BigInteger),
    Column('jit_deform_time', Double(53)),
    Column('stats_since', DateTime(True)),
    Column('minmax_stats_since', DateTime(True))
)


t_pg_stat_statements_info = Table(
    'pg_stat_statements_info', Base.metadata,
    Column('dealloc', BigInteger),
    Column('stats_reset', DateTime(True))
)


class Visitors(Base):
    __tablename__ = 'visitors'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='visitors_pkey'),
        Index('visitors_company_idx', 'company'),
        Index('visitors_user_id_idx', 'user_id')
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, server_default=text('gen_random_uuid()'))
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, server_default=text('auth.uid()'))
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    company: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    interest: Mapped[Optional[str]] = mapped_column(String(255))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    inquiries: Mapped[list['Inquiries']] = relationship('Inquiries', back_populates='visitor')


class Inquiries(Base):
    __tablename__ = 'inquiries'
    __table_args__ = (
        ForeignKeyConstraint(['visitor_id'], ['visitors.id'], name='inquiries_visitor_id_visitors_id_fk'),
        PrimaryKeyConstraint('id', name='inquiries_pkey'),
        Index('inquiries_created_at_idx', 'created_at'),
        Index('inquiries_status_idx', 'status'),
        Index('inquiries_user_id_idx', 'user_id'),
        Index('inquiries_visitor_id_idx', 'visitor_id')
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, server_default=text('gen_random_uuid()'))
    visitor_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, server_default=text('auth.uid()'))
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default=text("'pending'::character varying"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    contact: Mapped[Optional[str]] = mapped_column(String(255))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    visitor: Mapped['Visitors'] = relationship('Visitors', back_populates='inquiries')
