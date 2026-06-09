import { StudentModel } from './student.model';

export { StudentModel } from './student.model';
export type { IStudent, IStudentDocument, IStudentModel } from './student.model';

export const __studentsRegisteredModels = [StudentModel.modelName] as const;
