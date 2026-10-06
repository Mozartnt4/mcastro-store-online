import { DatabaseSync } from 'node:sqlite';

// SQLite réel derrière l'interface D1 : exécute SQL, contraintes et transactions.
export class D1 {
  constructor(path=':memory:'){ this.db=new DatabaseSync(path);this.db.exec('PRAGMA foreign_keys=ON'); }
  prepare(sql){
    const db=this.db;
    const statement=(args=[])=>({
      bind(...values){return statement(values);},
      async first(){return db.prepare(sql).get(...args)||null;},
      async all(){return {results:db.prepare(sql).all(...args)};},
      async run(){const r=db.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
    }); return statement();
  }
  async batch(statements){this.db.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());this.db.exec('COMMIT');return results;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  close(){this.db.close();}
}
