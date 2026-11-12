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
  // Подключение к Supabase (см. README, раздел «Авторизация»).
  // Вставьте Project URL и anon public key из Supabase: Project Settings -> API.
  supabase: {
    url: "https://sekhnzkjshshbeorlpkx.supabase.co",
    anonKey: "sb_publishable_GYs_qp1J6ILOflwfgu9avg_IKihzDKb"
  },
  // Домен для служебных адресов входа по нику (ник@домен). Менять не обязательно; письма на него не уходят.
  authDomain: "users.royale-shop.app",
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
      cat: "glasses",
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
      cat: "glasses",
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
      cat: "glasses",
      id: "balenciaga",
      name: "Balenciaga",
      price: 120,
      stock: true,
      image: "",
      specs: ["Глянцевый ацетат", "Тёмные линзы с принтом"],
      model: "models/balenciaga.glb",
      ar: { scale: 1, x: 0, y: 0, z: 0 }
    },
    {
      cat: "hats",
      kind: "hat",                      // AR садит модель на голову, а не на нос
      id: "beanie-black",
      name: "Royale Шапка",
      price: 35,
      stock: true,
      image: "",
      specs: ["Чёрный трикотаж", "Металлическая пластина"],
      model: "models/beanie.glb",
      ar: { scale: 0.85, x: 0, y: 0, z: 0, tilt: 4 }
    },
    {
      cat: "hats",
      kind: "hat",
      id: "ushanka-black",
      name: "Royale Ушанка",
      price: 55,
      stock: true,
      image: "",
      specs: ["Тёмный мех", "Опускающиеся «уши»", "Отворот на лбу", "Металлический шильдик"],
      model: "models/ushanka.glb",
      ar: { scale: 1, x: 0, y: 0, z: 0, tilt: 4, flapSwing: 0.55 },
      view: { zoom: 1.28 }               // крупнее в 3D-просмотре
    },
    {
      cat: "hats",
      kind: "hat",
      id: "cap-distressed",
      name: "Royale Кепка",
      price: 45,
      stock: true,
      image: "",
      specs: ["Состаренный хлопок", "Принт BALENICAGA", "Металлические люверсы"],
      model: "models/cap.glb",
      ar: { scale: 1, x: 0, y: 0, z: 0, tilt: 4 }
    }
  ]
};
