const Customer = require('../models/userSchema');

const customerInfo = async (req, res) => {
  try {
    let search = req.query.search || ''
    let page = parseInt(req.query.page) || 1
    const limit = 10;

    const query = {
      role: 'user',
      $or: [
        {fullName:{$regex: '.*' + search + '.*', $options: 'i'}},
        {email:{$regex: '.*' + search + '.*', $options: 'i'}}
      ],
    }

    
    const count = await Customer.countDocuments(query)

    // list users (sorted)
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const totalPages = Math.ceil(count / limit)

    res.render('admin/customer', {
      customers, 
      search,
      page,
      totalPages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

const blockStatus= async(req,res)=>{
    try {
        const { id, action } = req.body

    const isBlocked = action === 'block'
    await Customer.findByIdAndUpdate(id, { isBlocked });
        res.status(200).json({
            success:true,
            message: `Customer ${isBlocked} ? 'blocked' : 'unblocked' successfully`,
        })
        
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success:false,
            message:'internal server error'
        })
        
    }
}


module.exports = { customerInfo,blockStatus };
