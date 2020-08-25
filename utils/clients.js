const clients = [];

// 客戶端的資料
/*
id: socket.id
name: 暱稱或帳號
room: roomid
detial: 客戶資料
linktime: 進線時間
lang: 客戶選擇的語言
accid: account id, 如果沒有就顯示0
status: 0 => 沒有被服務, 1 => 有被服務
*/
function clientJoin(id, name, room, detial, linktime, lang, status) {
  const client = { id, name, room, detial, linktime, lang, status };
  clients.push(client);
  return client;
}

// 取得現在客戶的資料
function getCurrentClient(id) {
  let client = clients.find((client) => client.id === id);
  if (client === undefined) {
    return false;
  } else {
    return client;
  }
}

// 客戶離開
function clientLeave(id) {
  const index = clients.findIndex((client) => client.id === id);
  if (index != -1) {
    const client = clients.splice(index, 1)[0];
    return client;
  } else {
    return false;
  }
}

// 取的room中的client
function getClientRoom(room) {
  return clients.filter((client) => client.room === room);
}

// 取得所有的client
function getAllClient() {
  return clients;
}

// 判斷client是否存在
function clientExist(id) {
  const index = clients.findIndex((client) => client.id === id);
  if (index != -1) {
    return index;
  } else {
    return false;
  }
}

// 修改status
function clientEditStatus(id, status) {
  const index = clients.findIndex((client) => client.id === id);
  if (index !== -1) {
    clients[index].status = status;
    return clients[index];
  }
}

// 拿取沒被服務的client
function getNoServiceClient() {
  const index = clients.findIndex((client) => client.status === 0);
  if (index !== -1) {
    return clients[index];
  } else {
    return false;
  }
}

// 修改detial地區
function clientEditArea(id, area) {
  const index = clients.findIndex((client) => client.id === id);
  if (index !== -1) {
    clients[index].detial.area = area;
    return clients[index];
  }
}

module.exports = {
  clientJoin,
  getCurrentClient,
  clientLeave,
  getClientRoom,
  getAllClient,
  clientExist,
  clientEditStatus,
  getNoServiceClient,
  clientEditArea,
};
