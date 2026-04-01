Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import AssociativeNetworkDefinitions.

(* Функция преобразования TupleOfReferences в ReferenceList *)
Fixpoint TupleOfReferencesToReferenceList {n : nat} (v : TupleOfReferences n) : ReferenceList :=
  match v with
  | Vector.nil _ => List.nil
  | Vector.cons _ h _ t => List.cons h (TupleOfReferencesToReferenceList t)
  end.

(* Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkReferenceListFunction *)
Definition TupleFunctionToReferenceListFunction {n : nat} (a: AssociativeNetworkTupleFunction n) : AssociativeNetworkReferenceListFunction :=
  fun id => TupleOfReferencesToReferenceList (a id).

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkReferenceListList *)
Definition TupleListToReferenceListList {n: nat} (net: AssociativeNetworkTupleList n) : AssociativeNetworkReferenceListList :=
  map TupleOfReferencesToReferenceList net.

(* Функция преобразования ReferenceList в TupleOfReferences, возвращающая option *)
Fixpoint ReferenceListToTupleOfReferencesOption (n: nat) (p: ReferenceList) : option (TupleOfReferences n) :=
  match n, p with
  | 0, List.nil => Some (Vector.nil nat)
  | S n', List.cons f p' =>
  match ReferenceListToTupleOfReferencesOption n' p' with
  | None => None
  | Some t => Some (Vector.cons nat f n' t)
  end
  | _, _ => None
  end.

(* Функция преобразования ReferenceList в TupleOfReferences с использованием TupleOfReferencesDefault *)
Definition ReferenceListToTupleOfReferences (n: nat) (p: ReferenceList) : TupleOfReferences n :=
  match ReferenceListToTupleOfReferencesOption n p with
  | None => TupleOfReferencesDefault n
  | Some t => t
  end.

(* Функция преобразования AssociativeNetworkReferenceListFunction в AssociativeNetworkTupleFunction *)
Definition ReferenceListFunctionToTupleFunction { n: nat } (net: AssociativeNetworkReferenceListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match ReferenceListToTupleOfReferencesOption n (net id) with
  | Some t => t
  | None => TupleOfReferencesDefault n
  end.

(* Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkTupleList *)
Definition ReferenceListListToTupleList {n: nat} (net : AssociativeNetworkReferenceListList) : AssociativeNetworkTupleList n :=
  map (ReferenceListToTupleOfReferences n) net.

(* Функция преобразования ReferenceList в AssociativeNetworkDupletList со смещением индексации *)
Fixpoint ReferenceListToDupletList_ (offset: nat) (np: ReferenceList) : AssociativeNetworkDupletList :=
  match np with
  | nil => nil
  | cons h nil => cons (h, offset) nil
  | cons h t => cons (h, S offset) (ReferenceListToDupletList_ (S offset) t)
  end.

(* Функция преобразования ReferenceList в AssociativeNetworkDupletList *)
Definition ReferenceListToDupletList (np: ReferenceList) : AssociativeNetworkDupletList := ReferenceListToDupletList_ 0 np.

(* Функция добавления ReferenceList в хвост AssociativeNetworkDupletList *)
Definition AddReferenceListToDupletList (anet: AssociativeNetworkDupletList) (np: ReferenceList) : AssociativeNetworkDupletList :=
  app anet (ReferenceListToDupletList_ (length anet) np).

(* Функция отрезает голову anetd и возвращает хвост начиная с offset *)
Fixpoint DupletListBehead (anet: AssociativeNetworkDupletList) (offset : nat) : AssociativeNetworkDupletList :=
  match offset with
  | 0 => anet
  | S n' =>
  match anet with
  | nil => nil
  | cons h t => DupletListBehead t n'
  end
  end.

(* Функция преобразования AssociativeNetworkDupletList в ReferenceList с индексацией в начале AssociativeNetworkDupletList начиная с offset *)
Fixpoint DupletListToReferenceList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat): ReferenceList :=
  match anet with
  | nil => nil
  | cons (x, next_index) tail_anet =>
  if offset =? index then
  cons x (DupletListToReferenceList_ tail_anet (S offset) next_index)
  else
  DupletListToReferenceList_ tail_anet (S offset) index
  end.

(* Функция чтения ReferenceList из AssociativeNetworkDupletList по индексу дуплета *)
Definition DupletListReadReferenceList (anet: AssociativeNetworkDupletList) (index: nat) : ReferenceList :=
  DupletListToReferenceList_ anet 0 index.

(* Функция преобразования AssociativeNetworkDupletList в ReferenceList начиная с головы списка ассоциативной сети *)
Definition DupletListToReferenceList (anet: AssociativeNetworkDupletList) : ReferenceList := DupletListReadReferenceList anet 0.

(*
  Теперь всё готово для преобразования ассоциативной сети вложенных упорядоченных пар anetl : Reference → ReferenceList
  в ассоциативную сеть дуплетов anetd : Reference → Reference².

  Данное преобразование можно делать по-разному: с сохранением исходных ссылок на кортежи
  либо с переиндексацией. Переиндексацию можно не делать, если написать дополнительную функцию для
  ассоциативной сети дуплетов, которая возвращает вложенную упорядоченную пару по её ссылке.
*)

(* Функция добавления AssociativeNetworkReferenceListList в AssociativeNetworkDupletList *)
Fixpoint AddReferenceListListToDupletList (anetd: AssociativeNetworkDupletList) (anetl: AssociativeNetworkReferenceListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => anetd
  | cons h t => AddReferenceListListToDupletList (AddReferenceListToDupletList anetd h) t
  end.

(* Функция преобразования AssociativeNetworkReferenceListList в AssociativeNetworkDupletList *)
Definition ReferenceListListToDupletList (anetl: AssociativeNetworkReferenceListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => nil
  | cons h t => AddReferenceListListToDupletList (ReferenceListToDupletList h) t
  end.

(* Функция поиска ReferenceList в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
   Возвращает offset ReferenceList. *)
Fixpoint DupletListOffsetReferenceList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat) : nat :=
  match anet with
  | nil => offset + (length anet)
  | cons (_, next_index) tail_anet =>
  match index with
  | O => offset
  | S index' =>
  if offset =? next_index then
  DupletListOffsetReferenceList_ tail_anet (S offset) index'
  else
  DupletListOffsetReferenceList_ tail_anet (S offset) index
  end
  end.

(* Функция поиска ReferenceList в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset ReferenceList. *)
Definition DupletListOffsetReferenceList (anet: AssociativeNetworkDupletList) (index: nat) : nat :=
  DupletListOffsetReferenceList_ anet 0 index.

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList *)
Definition TupleListToDupletList {n : nat} (anetv: AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  ReferenceListListToDupletList (TupleListToReferenceListList anetv).

(*
  Теперь всё готово для преобразования ассоциативной сети дуплетов anetd : Reference → Reference²
  в ассоциативную сеть вложенных упорядоченных пар anetl : Reference → ReferenceList.

  Данное преобразование будем делать с сохранением исходных ссылок на кортежи.
  Переиндексацию можно не делать, потому что есть функция DupletListOffsetReferenceList для
  ассоциативной сети дуплетов, которая возвращает смещение вложенной УП по ссылке на неё.
*)

(* Функция отрезает первую ReferenceList из AssociativeNetworkDupletList и возвращает хвост *)
Fixpoint DupletListBeheadReferenceList (anet: AssociativeNetworkDupletList) (offset: nat) : AssociativeNetworkDupletList :=
  match anet with
  | nil => nil
  | cons (_, next_index) tail_anet =>
  if offset =? next_index then (* конец ReferenceList *)
  tail_anet
  else (* ещё не конец ReferenceList *)
  DupletListBeheadReferenceList tail_anet (S offset)
  end.

(* Функция преобразования ReferenceList и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkReferenceListList *)
Fixpoint DupletListToReferenceListList_ (anetd: AssociativeNetworkDupletList) (np: ReferenceList) (offset: nat) : AssociativeNetworkReferenceListList :=
  match anetd with
  | nil => nil (* отбрасываем ReferenceList даже если она недостроена *)
  | cons (x, next_index) tail_anet =>
  if offset =? next_index then (* конец ReferenceList, переходим к следующей ReferenceList *)
  cons (app np (cons x nil)) (DupletListToReferenceListList_ tail_anet nil (S offset))
  else (* ещё не конец ReferenceList, парсим ассоциативную сеть дуплетов дальше *)
  DupletListToReferenceListList_ tail_anet (app np (cons x nil)) (S offset)
  end.

(* Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkReferenceListList *)
Definition DupletListToReferenceListList (anetd: AssociativeNetworkDupletList) : AssociativeNetworkReferenceListList :=
  DupletListToReferenceListList_ anetd nil ReferenceDefault.
