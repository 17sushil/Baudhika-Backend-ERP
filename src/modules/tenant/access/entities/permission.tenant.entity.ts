import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Atomic action written as module.action, e.g. user.create. Seeded by migrations, never edited by schools. */
@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'text', unique: true }) code: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
}
