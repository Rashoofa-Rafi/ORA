const mongoose = require('mongoose')

const subcategorySchema = new mongoose.Schema({
    category_Id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category', // ✅ important so populate works
        required: true
    },
    name: {
        type: String,
        trim: true,
        required: true 
        
    },
    description: {
        type: String,
        trim: true,
        required: true
    },
    image: {
        type: String,
        default: ''
    },
    isListed: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })

subcategorySchema.index({ category_Id: 1, name: 1 }, { unique: true })

module.exports = mongoose.model('Subcategory', subcategorySchema)
