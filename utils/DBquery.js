const mysql = require("mysql");
const dbsetting = require("../config/dbsetting.js");
const db_config = dbsetting;

// 創建mysql連線池
const pool = mysql.createPool(db_config);

// 查詢資料庫
const dbquery = function (sql) {
  return new Promise((resolve) => {
    pool.getConnection((error, connection) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        connection.query(sql, (error, results) => {
          if (!error && Object.keys(results).length != 0) {
            resolve(results);
          } else {
            resolve(false);
          }
          connection.release(); // 釋放掉這個連線
        });
      }
    });
  });
};

// 寫入資料庫
var dbinsert = function (sql, addsqlparams) {
  return new Promise((resolve) => {
    pool.getConnection((error, connection) => {
      if (error) {
        console.log(error);
        resolve(false);
      } else {
        connection.query(sql, addsqlparams, (error, results) => {
          if (error) {
            resolve(false);
          } else {
            console.log("ok");
            resolve(true);
          }
          connection.release();
        });
      }
    });
  });
};

module.exports = {
  dbquery,
  dbinsert,
};
