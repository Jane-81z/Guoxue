import Dexie, { type Table } from 'dexie'
import type {
  AudioAsset,
  AudioBlobRecord,
  DailyStat,
  Passage,
  SettingsRecord,
  Work,
} from '../types'

/**
 * 本地库。录音二进制单独放 audioBlobs 表，列表页只读元数据，
 * 避免几百段音频一次性载入内存。
 */
class AppDatabase extends Dexie {
  works!: Table<Work, string>
  passages!: Table<Passage, string>
  audios!: Table<AudioAsset, string>
  audioBlobs!: Table<AudioBlobRecord, string>
  dailyStats!: Table<DailyStat, string>
  settings!: Table<SettingsRecord, string>
  tombstones!: Table<{ id: string; deletedAt: number }, string>

  constructor() {
    super('guoxue-recitation')
    this.version(1).stores({
      works: 'id, createdAt, title',
      passages: 'id, workId, order, isRecite, audioId',
      audios: 'id, passageId, workId',
      audioBlobs: 'id',
      dailyStats: 'date',
      settings: 'key',
    })
    // v2：加入删除墓碑，让「删掉的东西」不会在同步后被另一端带回来
    this.version(2).stores({
      tombstones: 'id, deletedAt',
    })
  }
}

export const db = new AppDatabase()
