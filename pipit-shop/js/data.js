/*
  Данные магазина. Здесь добавляются товары.
  Пока список пуст, сайт показывает пустые места под товар.

  Пример товара:
  {
    id: "frame-black",              // уникальный id, латиницей
    name: "Royale Чёрные",           // название
    price: 80,                      // цена в евро
    stock: true,                    // false покажет «Нет в наличии»
    image: "img/frame-black.png",   // картинка в папке img (можно оставить пустой) // бегущая строка под товаром (необязательно)
    specs: ["24 г", "Линзы UV400"], // характеристики справа (необязательно)
    model: "models/sunglasses.glb", // 3D-модель (glb): включает 3D-просмотр и AR-примерку
    ar: { scale: 1, x: 0, y: 0, z: 0 } // подгонка очков на лице (необязательно), см. README
  }
*/
window.PIPIT = {
  currency: "€",
  freeShippingFrom: 120,   // бесплатная доставка от этой суммы
  shippingEU: 8,           // доставка по ЕС ниже порога
  slots: 5,                // сколько пустых карточек показывать, пока товаров мало
  weather: {
    // Координаты по умолчанию для погоды. Посетитель может нажать «Моё место».
    city: "Кызылорда",
    lat: 44.85,
    lon: 65.51
  },
  products: [
    {
      id: "sunglasses-black",
      name: "Royale Чёрные",
      price: 80,
      stock: true,
      image: "",
      specs: ["Чёрный ацетат", "Тёмные линзы"],
      model: "models/sunglasses.glb",
      ar: { scale: 1, x: 0, y: 0, z: 0 }
    },
    {
      id: "aviator-green",
      name: "Royale Авиатор",
      price: 120,
      stock: true,
      image: "",
      specs: ["Чёрный ацетат", "Зелёные линзы", "Накладка из металла"],
      model: "models/aviator.glb",
      ar: { scale: 1, x: 0, y: 0, z: 0 }
    },
    {
      id: "balenciaga",
      name: "Balenciaga",
      price: 120,
      stock: true,
      image: "",
      specs: ["Глянцевый ацетат", "Тёмные линзы с принтом"],
      model: "models/balenciaga.glb",
      ar: { scale: 1, x: 0, y: 0, z: 0 }
    }
  ]
};
