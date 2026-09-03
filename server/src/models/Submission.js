import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, index: true },
    taskTitle: { type: String, required: true },
    taskDescription: { type: String, default: '' },
    difficulty: { type: String, default: 'medium' },
    score: { type: Number, required: true, min: 0, max: 100 },
    feedback: {
      summary: { type: String, default: '' },
      strengths: { type: [String], default: [] },
      improvements: { type: [String], default: [] },
      fileComments: { type: [{ file: String, comment: String }], default: [] },
    },
    files: { type: [{ name: String, content: String }], default: [] },
    participants: {
      type: [{ name: String, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }],
      default: [],
    },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Number, default: () => Date.now() },
  },
  { timestamps: true }
);

submissionSchema.index({ 'participants.userId': 1 });

export default mongoose.model('Submission', submissionSchema);
