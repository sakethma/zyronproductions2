const Razorpay = require('razorpay');
const rzp = new Razorpay({
  key_id: 'rzp_test_TDhpXtLMsMhkZs',
  key_secret: 'MOQe2kMlkDmG4ErfS2hlb89B'
});
rzp.orders.create({ amount: 1000, currency: "INR", receipt: "rcptid_11" }).then(console.log).catch(console.error);
