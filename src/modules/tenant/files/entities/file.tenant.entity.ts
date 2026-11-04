import { Check, Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Registry of uploaded objects. The bytes live in private storage (S3); serve via short-lived signed URLs. */
@Entity('files')
@Check('chk_files_size', `size_bytes >= 0`)
@Unique('uq_files_storage_key', ['storageKey'])
export class StoredFile {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'storage_key', type: 'text' }) storageKey: string;
  @Column({ name: 'original_name', type: 'text' }) originalName: string;
  @Column({ name: 'mime_type', type: 'text' }) mimeType: string;
  @Column({ name: 'size_bytes', type: 'bigint' }) sizeBytes: string;
  @Column({ type: 'text', nullable: true }) checksum: string | null;
  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true }) uploadedBy: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' }) deletedAt: Date | null;
}
