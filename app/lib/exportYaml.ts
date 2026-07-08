import { Node, Edge } from '@xyflow/react';

export function generateAnsibleYAML(nodes: Node[], edges: Edge[]): string {
  // If the canvas is empty, return a comment
  if (nodes.length === 0) {
    return '# Your infrastructure canvas is currently empty.\n# Add nodes to generate an Ansible playbook.';
  }

  // Set up the Ansible Playbook boilerplate
  let yamlString = `---
- name: Automated Infrastructure Provisioning
  hosts: all
  become: yes
  tasks:
\n`;

  // For v1, we will map through the nodes based on their order in the array.
  // (In a future update, we can use the 'edges' array to do a topological sort 
  // so the pipeline strictly follows the connection arrows).
  
  nodes.forEach((node) => {
    const label = node.data.label as string;

    // Map each visual node to its corresponding Ansible YAML block
    if (label.includes('Update Packages')) {
      yamlString += `    - name: Update apt cache and upgrade packages
      ansible.builtin.apt:
        update_cache: yes
        upgrade: dist\n\n`;
    } 
    else if (label.includes('Install Nginx')) {
      yamlString += `    - name: Install Nginx Web Server
      ansible.builtin.apt:
        name: nginx
        state: present\n\n`;
    } 
    else if (label.includes('Install Node.js')) {
      yamlString += `    - name: Install Node.js
      ansible.builtin.apt:
        name: nodejs
        state: present\n\n`;
    }
    else if (label.includes('PostgreSQL')) {
      yamlString += `    - name: Install PostgreSQL
      ansible.builtin.apt:
        name: postgresql
        state: present\n\n`;
    }
    // Add additional conditions for Open Port, Copy .env, etc.
  });

  return yamlString;
}