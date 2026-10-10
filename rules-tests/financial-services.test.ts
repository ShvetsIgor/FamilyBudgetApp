import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, collection, Timestamp, type Firestore } from 'firebase/firestore';
const current = vi.hoisted(() => ({ db: null as Firestore | null }));
vi.mock('@/shared/lib/firebase', () => ({ getDb: () => current.db }));
import { addExpense, updateExpense, deleteExpense, restoreExpense } from '@/features/expenses/services/expensesService';
import { addIncome, deleteIncome } from '@/features/income/services/incomeService';
import { loadCurrentMonthIncomes } from '@/features/income/services/incomeStartupService';
import { addRecurringWithFirstOccurrence, payRecurringOccurrence } from '@/features/recurring/services/recurringService';
import { addGoal, fetchGoalById } from '@/features/savings/services/savingsService';
import { addContributionWithExpense } from '@/features/savings/services/savingsExpenseService';
import { toLocalDateKey, toLocalMonthKey } from '@/shared/utils/dateKey';
import type { Category } from '@/shared/types';

let env: RulesTestEnvironment;
const date = new Date(2026, 8, 10, 12);
const base = { userId: 'alice', amount: 100, currency: 'ILS' as const, categoryId: 'food', date,
  paymentMethod: 'card' as const, tags: [], privacy: 'regular' as const, splits: [] };
const category: Category = { id: 'food', userId: 'alice', type: 'expense', name: 'Food', icon: 'cart', color: '#fff', order: 0, isPrivate: false };
const stats = () => getDoc(doc(current.db!, 'monthlyStats', 'alice', 'months', toLocalMonthKey(date)));
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'family-budget-services-test', firestore: {
    host: '127.0.0.1', port: 8090, rules: readFileSync('firestore.rules', 'utf8'),
  } });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  current.db = env.authenticatedContext('alice', { email: 'alice@example.test', email_verified: true }).firestore() as unknown as Firestore;
  await env.withSecurityRulesDisabled(async c => {
    for (const uid of ['alice', 'bob']) {
      await setDoc(doc(c.firestore(), 'users', uid), { id: uid, familyId: 'f' });
      for (const type of ['expense', 'income']) {
        await setDoc(doc(c.firestore(), 'categories', uid, type, 'food'), { ...category, type, userId: uid });
        await setDoc(doc(c.firestore(), 'categories', uid, type, 'private'), { ...category, type, userId: uid, isPrivate: true });
      }
    }
    await setDoc(doc(c.firestore(), 'families', 'f'), { ownerId: 'alice', memberIds: ['alice','bob'] });
  });
});
it('concurrent stale edits keep the aggregate equal to the actual expense', async () => {
  const expense = await addExpense(base);
  await Promise.all([150,200].map(amount => updateExpense({ ...base, id: expense.id, previousExpense: expense, amount })));
  const saved = await getDoc(doc(current.db!, 'expenses','alice','items',expense.id));
  expect((await stats()).data()?.totalExpenses).toBe(saved.data()?.amount);
});
it('concurrent deletes subtract once and repeated restores add once', async () => {
  const expense = await addExpense(base);
  const deletions = await Promise.all([deleteExpense('alice',expense),deleteExpense('alice',expense)]);
  expect((await stats()).data()?.totalExpenses).toBe(0);
  const deletion = deletions.find(d => d.expense)!;
  await Promise.all([restoreExpense('alice',deletion),restoreExpense('alice',deletion)]);
  expect((await stats()).data()?.totalExpenses).toBe(100);
});
it('chat receipt deduplicates concurrent retries and survives deletion', async () => {
  const results = await Promise.all([addExpense({...base,operationId:'chat-1'}),addExpense({...base,operationId:'chat-1'})]);
  expect(results[0].id).toBe(results[1].id);
  expect((await stats()).data()?.totalExpenses).toBe(100);
  await deleteExpense('alice',results[0]);
  await expect(addExpense({...base,operationId:'chat-1'})).rejects.toThrow('entry-already-deleted');
  expect((await stats()).data()?.totalExpenses).toBe(0);
});
it('income uses category privacy and repeated deletion is harmless', async () => {
  const income = await addIncome({...base,method:'bank',categoryId:'private'});
  expect(income.privacy).toBe('secret');
  await Promise.all([deleteIncome('alice',income),deleteIncome('alice',income)]);
  expect((await stats()).data()?.totalIncome).toBe(0);
});
it('two startup callers book a salary occurrence exactly once', async () => {
  const now = new Date();
  await setDoc(doc(current.db!,'recurringIncome','alice','items','salary'),{userId:'alice',name:'Salary',amount:100,currency:'ILS',categoryId:'food',dayOfMonth:now.getDate(),nextDueDate:toLocalDateKey(now),isActive:true,createdAt:Timestamp.now()});
  await Promise.all([loadCurrentMonthIncomes('alice'),loadCurrentMonthIncomes('alice')]);
  expect((await getDocs(collection(current.db!,'incomes','alice','items'))).size).toBe(1);
});
it('first family contribution to a newly created goal works', async () => {
  const goal = await addGoal({userId:'alice',name:'Trip',icon:'star',color:'#fff',targetAmount:1000,currency:'ILS'});
  current.db = env.authenticatedContext('bob',{email_verified:true}).firestore() as unknown as Firestore;
  const result = await addContributionWithExpense({userId:'bob',goal,amount:50,date,label:'Savings',expenseCategories:[],categoryId:'food'});
  expect(result.goal.currentAmount).toBe(50);
  expect(result.expense.goalOwnerId).toBe('alice');
});
it('linked contribution deletion and Undo keep goal and expenses atomic', async () => {
  const goal = await addGoal({userId:'alice',name:'Trip',icon:'star',color:'#fff',targetAmount:1000,currency:'ILS'});
  const {expense} = await addContributionWithExpense({userId:'alice',goal,amount:100,date,label:'Savings',expenseCategories:[category],categoryId:'food'});
  const deletion = await deleteExpense('alice',expense);
  expect((await fetchGoalById('alice',goal.id))?.currentAmount).toBe(0);
  await restoreExpense('alice',deletion);
  expect((await fetchGoalById('alice',goal.id))?.currentAmount).toBe(100);
  expect((await stats()).data()?.totalExpenses).toBe(100);
});
it('savings expense respects private category and immutable linked amount', async () => {
  const goal = await addGoal({userId:'alice',name:'Trip',icon:'star',color:'#fff',targetAmount:1000,currency:'ILS'});
  const {expense} = await addContributionWithExpense({userId:'alice',goal,amount:100,date,label:'Savings',expenseCategories:[category],categoryId:'private'});
  expect(expense.privacy).toBe('secret');
  await expect(updateExpense({...base,id:expense.id,amount:150,previousExpense:expense})).rejects.toThrow('linked-expense-use-original-flow');
  const edited = await updateExpense({...base,id:expense.id,comment:'Note',previousExpense:expense});
  expect(edited.goalId).toBe(goal.id);expect(edited.contributionId).toBe(expense.contributionId);expect(edited.privacy).toBe('secret');
});
it('concurrent mark-paid and delete/Undo preserve recurring schedule', async () => {
  const tomorrow = new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const {recurring} = await addRecurringWithFirstOccurrence({userId:'alice',name:'Bill',amount:100,currency:'ILS',categoryId:'food',frequency:'monthly',startDate:tomorrow,type:'subscription',reminderDays:1},(id,due)=>({...base,recurringId:id,date:due}));
  const results = await Promise.all([payRecurringOccurrence('alice',recurring),payRecurringOccurrence('alice',recurring)]);
  expect(results.filter(r=>r.expense)).toHaveLength(1);
  const paid = results.find(r=>r.expense)!;
  const deletion = await deleteExpense('alice',paid.expense!);
  expect(toLocalDateKey(deletion.recurring!.nextDueDate)).toBe(toLocalDateKey(recurring.nextDueDate));
  const restored = await restoreExpense('alice',deletion);
  expect(toLocalDateKey(restored!.nextDueDate)).toBe(toLocalDateKey(paid.recurring.nextDueDate));
});
it('a contributor can still delete their expense after the goal owner hides the goal', async () => {
  const goal = await addGoal({userId:'alice',name:'Trip',icon:'star',color:'#fff',targetAmount:1000,currency:'ILS'});
  current.db = env.authenticatedContext('bob',{email_verified:true}).firestore() as unknown as Firestore;
  const {expense} = await addContributionWithExpense({userId:'bob',goal,amount:50,date,label:'Savings',expenseCategories:[],categoryId:'food'});
  await env.withSecurityRulesDisabled(c => updateDoc(doc(c.firestore(),'savingsGoals','alice','goals',goal.id),{isPrivate:true}));
  const deletion = await deleteExpense('bob',expense);
  expect(deletion.expense?.id).toBe(expense.id);
  expect(deletion.links.contribution).toBeUndefined();
  expect((await getDoc(doc(current.db!,'expenses','bob','items',expense.id))).exists()).toBe(false);
});
it('a template without category is refused instead of advancing without an expense', async () => {
  const tomorrow = new Date();tomorrow.setDate(tomorrow.getDate()+1);
  const {recurring} = await addRecurringWithFirstOccurrence({userId:'alice',name:'Bill',amount:100,currency:'ILS',categoryId:'food',frequency:'monthly',startDate:tomorrow,type:'subscription',reminderDays:1},(id,due)=>({...base,recurringId:id,date:due}));
  await updateDoc(doc(current.db!,'recurringPayments','alice','items',recurring.id),{categoryId:''});
  await expect(payRecurringOccurrence('alice',{...recurring,categoryId:''})).rejects.toThrow('recurring-category-required');
  const saved = await getDoc(doc(current.db!,'recurringPayments','alice','items',recurring.id));
  expect(toLocalDateKey((saved.data()!.nextDueDate as Timestamp).toDate())).toBe(toLocalDateKey(recurring.nextDueDate));
});
