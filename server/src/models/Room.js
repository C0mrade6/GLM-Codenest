import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    id: String,
    name: { type: String, required: true },
    content: { type: String, default: '' },
    version: { type: Number, default: 0 },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByGuestName: { type: String, default: '' },
    status: { type: String, enum: ['active', 'ended'], default: 'active', index: true },
    mode: { type: String, enum: ['practice', 'learning'], default: 'practice' },
    files: { type: [fileSchema], default: [] },
    learningTaskTitle: { type: String, default: '' },
    createdAt: { type: Number, required: true },
    endsAt: { type: Number, required: true },
    endedAt: { type: Number },
    endedReason: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Room', roomSchema);
