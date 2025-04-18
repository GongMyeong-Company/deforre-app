import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { collection, addDoc, getDocs, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

type TodoItem = {
  id: string;
  text: string;
  createdAt: any;
};

export default function FirestoreExample() {
  const [todoText, setTodoText] = useState('');
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);

  // 컴포넌트 마운트 시 할 일 목록 불러오기
  useEffect(() => {
    fetchTodos();
  }, []);

  // Firestore에서 데이터 가져오기
  const fetchTodos = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'todos'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const todosList: TodoItem[] = [];
      querySnapshot.forEach((doc) => {
        todosList.push({
          id: doc.id,
          ...doc.data(),
        } as TodoItem);
      });
      
      setTodos(todosList);
    } catch (error: any) {
      Alert.alert('오류', '할 일 목록을 불러오는데 실패했습니다.');
      console.error('Error fetching todos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Firestore에 데이터 추가하기
  const addTodo = async () => {
    if (todoText.trim() === '') {
      Alert.alert('오류', '할 일을 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'todos'), {
        text: todoText,
        createdAt: serverTimestamp(),
      });
      
      setTodoText('');
      fetchTodos(); // 할 일 목록 갱신
      Alert.alert('성공', '할 일이 추가되었습니다.');
    } catch (error: any) {
      Alert.alert('오류', '할 일 추가에 실패했습니다.');
      console.error('Error adding todo:', error);
    }
  };

  // Firestore에서 데이터 삭제하기
  const deleteTodo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'todos', id));
      fetchTodos(); // 할 일 목록 갱신
    } catch (error: any) {
      Alert.alert('오류', '할 일 삭제에 실패했습니다.');
      console.error('Error deleting todo:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Firestore 예제</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="할 일 입력"
          value={todoText}
          onChangeText={setTodoText}
        />
        <TouchableOpacity onPress={addTodo} style={styles.addButton}>
          <Text style={styles.buttonText}>추가</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>로딩 중...</Text>
      ) : (
        <FlatList
          data={todos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.todoItem}>
              <Text style={styles.todoText}>{item.text}</Text>
              <TouchableOpacity 
                onPress={() => deleteTodo(item.id)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteButtonText}>삭제</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>할 일이 없습니다.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    margin: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#3498db',
    padding: 10,
    borderRadius: 5,
    justifyContent: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  todoItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 5,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  todoText: {
    flex: 1,
  },
  deleteButton: {
    backgroundColor: '#e74c3c',
    padding: 8,
    borderRadius: 5,
  },
  deleteButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 20,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
}); 