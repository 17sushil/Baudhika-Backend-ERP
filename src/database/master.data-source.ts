import 'dotenv/config';
import { DataSource } from 'typeorm';
import { masterOptions } from './master-options';

export default new DataSource(masterOptions());