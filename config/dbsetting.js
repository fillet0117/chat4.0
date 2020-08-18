const dbsetting = {
    host:'localhost',
    user:'root',
    password:'ty0321',
    database:'newsite',
    waitForConnections: true,
    connectionLimit: 20, // 最多連線數
    multipleStatements: true // 執行多條sql查詢
}
module.exports = {
    dbsetting
}