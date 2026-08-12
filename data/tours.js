// ----- Danh sách tour -----
const products = [
  {
    name: 'Hạ Long - Đảo Ti Tốp 3N2Đ',
    price: '2.590.000',
    category: 'Trong nước',
    image: '/picture/halong.jpg'
  },
  {
    name: 'Đà Lạt Mộng Mơ 2N1Đ',
    price: '1.890.000',
    category: 'Trong nước',
    image: '/picture/dalat.jpg'
  },
  {
    name: 'Phú Quốc Biển Xanh 3N2Đ',
    price: '3.290.000',
    category: 'Trong nước',
    image: '/picture/phuquoc.jpg'
  },
  {
    name: 'Sapa Săn Mây 2N1Đ',
    price: '2.190.000',
    category: 'Trong nước',
    image: '/picture/sapa.jpg'
  },
  {
    name: 'Thái Lan - Bangkok Pattaya 4N3Đ',
    price: '6.990.000',
    category: 'Nước ngoài',
    image: '/picture/thailan.jpg'
  },
  {
    name: 'Singapore - Malaysia 5N4Đ',
    price: '9.590.000',
    category: 'Nước ngoài',
    image: '/picture/singapore.jpg'
  }
];

// ----- Lý do nên chọn Viet Travel Tour -----
const whyChooseUs = [
  {
    icon: 'coffee',
    title: 'Giá tốt nhất thị trường',
    desc: 'Cam kết giá tour cạnh tranh, minh bạch, không phát sinh chi phí ẩn trong suốt hành trình.'
  },
  {
    icon: 'heart',
    title: 'Hướng dẫn viên tận tâm',
    desc: 'Đội ngũ hướng dẫn viên giàu kinh nghiệm, am hiểu địa phương, luôn đồng hành cùng bạn.'
  },
  {
    icon: 'clock',
    title: 'Lịch trình linh hoạt',
    desc: 'Dễ dàng tùy chỉnh lịch trình, hỗ trợ đặt tour nhanh chóng, xác nhận trong thời gian ngắn nhất.'
  }
];

module.exports = { products, whyChooseUs };